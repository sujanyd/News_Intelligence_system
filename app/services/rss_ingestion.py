"""
RSS Feed Ingestion Service.

Collects, parses, normalizes, and stores news articles from configured
RSS/Atom feeds into the PostgreSQL database.
"""

from datetime import datetime, timezone
import email.utils
import hashlib
import html
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import urllib.parse

import feedparser
import httpx
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import settings, DEFAULT_RSS_FEEDS
from app.models.news_source import NewsSource
from app.models.article import Article
from app.schemas.ingestion import FeedResultDetail, IngestionSummaryResponse

logger = logging.getLogger(__name__)

# Tracking query parameters commonly appended to article links
TRACKING_PARAMS: Set[str] = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_source_platform",
    "utm_creative_format",
    "utm_marketing_tactic",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "zanpid",
    "msclkid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "rss",
    "feed",
}


def normalize_url(raw_url: str) -> str:
    """
    Normalizes an article URL:
    - Strips leading/trailing whitespace
    - Lowercases scheme and netloc
    - Removes standard ports (:80, :443)
    - Strips tracking query parameters (utm_*, fbclid, etc.)
    - Deterministically sorts remaining query parameters
    - Normalizes path slashes
    - Strips fragment identifiers (#...)
    """
    if not raw_url or not isinstance(raw_url, str):
        return ""

    url = raw_url.strip()
    parsed = urllib.parse.urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        return url

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Remove standard port specifications
    if (scheme == "http" and netloc.endswith(":80")) or (
        scheme == "https" and netloc.endswith(":443")
    ):
        netloc = netloc.rsplit(":", 1)[0]

    # Filter out tracking query parameters
    query_tuples = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
    cleaned_tuples = [
        (k, v)
        for k, v in query_tuples
        if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    cleaned_tuples.sort(key=lambda x: x[0])
    new_query = urllib.parse.urlencode(cleaned_tuples)

    # Normalize trailing slash in path if not root
    path = parsed.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")

    return urllib.parse.urlunsplit((scheme, netloc, path, new_query, ""))


def compute_content_hash(text: Optional[str]) -> Optional[str]:
    """Computes a SHA-256 hash for deduplication and content integrity."""
    if not text:
        return None
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def clean_html_text(raw_html: Optional[str]) -> Optional[str]:
    """Strips HTML tags, unescapes entities, and collapses excessive whitespace."""
    if not raw_html:
        return None

    # Strip script and style blocks first
    text = re.sub(
        r"<script[^>]*>.*?</script>", "", raw_html, flags=re.DOTALL | re.IGNORECASE
    )
    text = re.sub(
        r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE
    )
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Unescape HTML entities (&amp; -> &, &quot; -> ", etc.)
    text = html.unescape(text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def parse_entry_published_at(entry: Any) -> Optional[datetime]:
    """
    Extracts and normalizes publication time from a feedparser entry into UTC.
    Safely falls back to updated time or string parsing, returning None on failure.
    """
    # 1. Prefer feedparser's pre-parsed UTC struct_time
    struct = entry.get("published_parsed") or entry.get("updated_parsed")
    if struct:
        try:
            return datetime(*struct[:6], tzinfo=timezone.utc)
        except (ValueError, TypeError):
            pass

    # 2. Fall back to raw string timestamp parsing
    date_str = (
        entry.get("published")
        or entry.get("pubDate")
        or entry.get("updated")
        or entry.get("dc:date")
    )
    if date_str and isinstance(date_str, str):
        try:
            parsed_dt = email.utils.parsedate_to_datetime(date_str)
            if parsed_dt:
                return parsed_dt.astimezone(timezone.utc)
        except Exception:
            pass

        try:
            parsed_dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return parsed_dt.astimezone(timezone.utc)
        except Exception:
            pass

    return None


def extract_entry_content(entry: Any) -> Tuple[Optional[str], str]:
    """
    Extracts article content and identifies the content availability level.

    Returns:
        Tuple of (content_text, content_availability)
        where content_availability is 'full_text', 'summary_only', or 'headline_only'.
    """
    # 1. Check for dedicated content blocks (e.g. <content:encoded> or Atom <content>)
    content_list = entry.get("content")
    if content_list and isinstance(content_list, list) and len(content_list) > 0:
        first_content = content_list[0]
        if isinstance(first_content, dict):
            raw_val = first_content.get("value")
            cleaned_val = clean_html_text(raw_val)
            if cleaned_val and len(cleaned_val) > 200:
                return cleaned_val, "full_text"

    # 2. Check for summary or description
    raw_summary = entry.get("summary") or entry.get("description")
    cleaned_summary = clean_html_text(raw_summary)
    if cleaned_summary:
        # Feeds provide summaries, not full articles
        return cleaned_summary, "summary_only"

    # 3. If no body or summary is provided, only the headline is available
    return None, "headline_only"


def fetch_and_parse_feed(
    feed_url: str,
    raw_xml: Optional[str | bytes] = None,
    timeout: int = 10,
) -> feedparser.FeedParserDict:
    """
    Retrieves and parses an RSS or Atom feed.
    Supports injecting raw_xml directly for testing and offline environments.
    """
    if raw_xml is not None:
        feed = feedparser.parse(raw_xml)
    else:
        try:
            response = httpx.get(
                feed_url,
                timeout=float(timeout),
                headers={"User-Agent": settings.RSS_USER_AGENT},
                follow_redirects=True,
            )
            response.raise_for_status()
            feed = feedparser.parse(response.content)
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"Connection timed out after {timeout}s: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"HTTP error {exc.response.status_code}: {exc}") from exc
        except httpx.RequestError as exc:
            raise ConnectionError(f"Network request failed: {exc}") from exc

    # Validate feed structure
    if feed.bozo == 1 and not feed.entries and not feed.feed.get("title"):
        bozo_exc = getattr(feed, "bozo_exception", "Invalid or malformed feed XML")
        raise ValueError(f"Failed to parse feed data: {bozo_exc}")

    return feed


def get_or_create_news_source(
    db: Session,
    source_name: str,
    base_url: str,
) -> NewsSource:
    """
    Retrieves an existing NewsSource record by name or base_url,
    or creates and registers a new one in the database.
    """
    source = (
        db.query(NewsSource)
        .filter(NewsSource.name == source_name)
        .first()
    )
    if not source:
        source = (
            db.query(NewsSource)
            .filter(NewsSource.base_url == base_url)
            .first()
        )

    if not source:
        source = NewsSource(
            name=source_name,
            base_url=base_url,
        )
        db.add(source)
        db.flush()

    return source


def ingest_single_feed(
    feed_cfg: Dict[str, str],
    db: Session,
    raw_xml: Optional[str | bytes] = None,
    max_articles: Optional[int] = None,
    timeout: int = 10,
) -> FeedResultDetail:
    """
    Ingests articles from a single configured RSS feed into PostgreSQL.
    Deduplicates URLs, validates entries, and safely records metadata.
    """
    source_name = feed_cfg.get("source_name", "Unknown Source")
    feed_url = feed_cfg.get("feed_url", "")
    base_url = feed_cfg.get("base_url", "https://example.com")

    if not feed_url:
        return FeedResultDetail(
            source_name=source_name,
            feed_url="",
            status="error",
            articles_inserted=0,
            articles_skipped_duplicate=0,
            error="Missing feed_url in configuration",
        )

    articles_inserted = 0
    articles_skipped_duplicate = 0
    seen_urls_in_run: Set[str] = set()

    try:
        # 1. Resolve or create parent NewsSource
        source = get_or_create_news_source(db, source_name=source_name, base_url=base_url)

        # 2. Fetch and parse feed entries
        feed = fetch_and_parse_feed(feed_url=feed_url, raw_xml=raw_xml, timeout=timeout)

        entries = feed.entries
        if max_articles is not None and max_articles > 0:
            entries = entries[:max_articles]

        # 3. Process each feed entry
        for entry in entries:
            # Validate URL
            raw_link = entry.get("link") or ""
            if not raw_link or not (raw_link.startswith("http://") or raw_link.startswith("https://")):
                logger.warning("Skipping entry without valid HTTP link: %s", entry.get("title", "No Title"))
                continue

            canonical_url = normalize_url(raw_link)
            if not canonical_url:
                continue

            # In-memory deduplication for the current run
            if canonical_url in seen_urls_in_run:
                articles_skipped_duplicate += 1
                continue

            # Check database for existing article with this URL or canonical_url
            existing_article = (
                db.query(Article)
                .filter(
                    (Article.url == canonical_url)
                    | (Article.url == raw_link)
                    | (Article.canonical_url == canonical_url)
                )
                .first()
            )
            if existing_article:
                seen_urls_in_run.add(canonical_url)
                articles_skipped_duplicate += 1
                continue

            # Parse Title with fallback
            raw_title = entry.get("title")
            cleaned_title = clean_html_text(raw_title)
            if not cleaned_title:
                # Fallback to summary snippet or generic title
                summary_snippet = clean_html_text(entry.get("summary") or entry.get("description"))
                cleaned_title = summary_snippet[:80] + "..." if summary_snippet else "Untitled Article"

            # Enforce max title length of 512
            title = cleaned_title[:512]

            # Parse content and content availability
            content, content_availability = extract_entry_content(entry)
            content_hash = compute_content_hash(content)

            # Parse publication timestamp
            published_at = parse_entry_published_at(entry)
            retrieved_at = datetime.now(timezone.utc)

            # Create Article record
            article = Article(
                source_id=source.id,
                title=title,
                content=content,
                url=canonical_url[:1024],
                canonical_url=canonical_url[:1024],
                content_availability=content_availability,
                content_hash=content_hash,
                published_at=published_at,
                retrieved_at=retrieved_at,
            )

            try:
                db.add(article)
                db.flush()
                seen_urls_in_run.add(canonical_url)
                articles_inserted += 1
            except IntegrityError:
                db.rollback()
                articles_skipped_duplicate += 1
                seen_urls_in_run.add(canonical_url)

        # Commit all successful inserts for this feed
        db.commit()

        return FeedResultDetail(
            source_name=source.name,
            feed_url=feed_url,
            status="success",
            articles_inserted=articles_inserted,
            articles_skipped_duplicate=articles_skipped_duplicate,
            error=None,
        )

    except Exception as exc:
        db.rollback()
        logger.error("Error ingesting feed %s: %s", feed_url, exc)
        return FeedResultDetail(
            source_name=source_name,
            feed_url=feed_url,
            status="error",
            articles_inserted=0,
            articles_skipped_duplicate=0,
            error=str(exc),
        )


def run_rss_ingestion(
    db: Session,
    feeds: Optional[List[Dict[str, str]]] = None,
    max_articles_per_feed: Optional[int] = None,
    timeout: Optional[int] = None,
    raw_feeds: Optional[Dict[str, str | bytes]] = None,
) -> IngestionSummaryResponse:
    """
    Executes the ingestion pipeline across all configured or supplied feeds.
    Fault-tolerant: a failure in one feed does not stop remaining feeds from processing.
    """
    feed_list = feeds if feeds is not None else DEFAULT_RSS_FEEDS
    effective_timeout = timeout or settings.RSS_FEED_TIMEOUT_SECONDS
    effective_limit = max_articles_per_feed or settings.RSS_MAX_ARTICLES_PER_FEED

    total_attempted = 0
    total_successful = 0
    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    details: List[FeedResultDetail] = []

    for feed_cfg in feed_list:
        total_attempted += 1
        feed_url = feed_cfg.get("feed_url", "")
        raw_xml = raw_feeds.get(feed_url) if raw_feeds else None

        detail = ingest_single_feed(
            feed_cfg=feed_cfg,
            db=db,
            raw_xml=raw_xml,
            max_articles=effective_limit,
            timeout=effective_timeout,
        )

        details.append(detail)
        if detail.status == "success":
            total_successful += 1
            total_inserted += detail.articles_inserted
            total_skipped += detail.articles_skipped_duplicate
        else:
            total_errors += 1

    return IngestionSummaryResponse(
        feeds_attempted=total_attempted,
        feeds_successful=total_successful,
        articles_inserted=total_inserted,
        articles_skipped_duplicate=total_skipped,
        feed_errors=total_errors,
        details=details,
    )

