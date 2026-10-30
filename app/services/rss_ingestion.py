"""
RSS Feed Ingestion Service.

Collects, parses, normalizes, and stores news articles from configured
RSS/Atom feeds into the PostgreSQL database.
Includes canonical URL normalization, duplicate prevention, exact-content hash checks,
and controlled retries for temporary feed failures.
"""

from datetime import datetime, timezone
import email.utils
import hashlib
import html
import logging
import re
import time
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

# Known tracking query parameters commonly appended to article links
TRACKING_PARAMS: Set[str] = {
    # UTM parameters
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_source_platform",
    "utm_creative_format",
    "utm_marketing_tactic",
    "utm_reader",
    "utm_place",
    "utm_userid",
    # Ad click identifiers
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "wbraid",
    "gbraid",
    "msclkid",
    "twclid",
    "yclid",
    "zanpid",
    # Social & email marketing trackers
    "igshid",
    "mc_cid",
    "mc_eid",
    "_hsenc",
    "_hsmi",
    "mkt_tok",
    "cmpid",
    "sc_src",
    "sc_cid",
    "sc_lid",
    # Referral & feed tags
    "ref",
    "ref_src",
    "rss",
    "feed",
}

# HTTP status codes that represent permanent client errors (do not retry)
PERMANENT_HTTP_STATUS_CODES: Set[int] = {
    400,  # Bad Request
    401,  # Unauthorized
    403,  # Forbidden
    404,  # Not Found
    405,  # Method Not Allowed
    410,  # Gone
    422,  # Unprocessable Entity
}


def normalize_url(raw_url: Optional[str]) -> str:
    """
    Normalizes an article URL into a canonical format:
    - Strips leading and trailing whitespace
    - Lowercases scheme and netloc (domain)
    - Strips default HTTP (:80) and HTTPS (:443) ports while preserving non-standard ports
    - Normalizes consecutive slashes in the path (e.g. //news/// -> /news/)
    - Safely strips trailing slashes on non-root paths (/story/ -> /story)
    - Strips known tracking parameters (utm_*, fbclid, gclid, etc.)
    - Preserves meaningful query parameters (id, v, p, article_id, story_id, etc.)
    - Sorts query parameters deterministically for consistency
    - Strips URL fragment identifiers (#section, #comments, etc.)
    """
    if not raw_url or not isinstance(raw_url, str):
        return ""

    url = raw_url.strip()
    if not url:
        return ""

    parsed = urllib.parse.urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        return url

    scheme = parsed.scheme.lower()

    # Normalize netloc: lowercase hostname, remove default ports, keep non-default ports
    hostname = (parsed.hostname or "").lower()
    if hostname:
        port = parsed.port
        if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
            port = None
        userinfo = ""
        if parsed.username:
            userinfo = parsed.username
            if parsed.password:
                userinfo += f":{parsed.password}"
            userinfo += "@"
        netloc = f"{userinfo}{hostname}:{port}" if port else f"{userinfo}{hostname}"
    else:
        netloc = parsed.netloc.lower()
        if (scheme == "http" and netloc.endswith(":80")) or (
            scheme == "https" and netloc.endswith(":443")
        ):
            netloc = netloc.rsplit(":", 1)[0]

    # Normalize path: collapse consecutive slashes and safely strip trailing slash on non-root paths
    path = parsed.path
    if path:
        path = re.sub(r"/{2,}", "/", path)
        if len(path) > 1 and path.endswith("/"):
            path = path.rstrip("/")

    # Filter out known tracking parameters while strictly preserving meaningful query parameters
    query_tuples = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
    cleaned_tuples = [
        (k, v)
        for k, v in query_tuples
        if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    # Deterministic sorting of query parameters
    cleaned_tuples.sort(key=lambda x: (x[0], x[1]))
    new_query = urllib.parse.urlencode(cleaned_tuples)

    # Reconstruct URL without fragment
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
        return cleaned_summary, "summary_only"

    # 3. If no body or summary is provided, only the headline is available
    return None, "headline_only"


def fetch_and_parse_feed(
    feed_url: str,
    raw_xml: Optional[str | bytes] = None,
    timeout: Optional[int] = None,
    max_retries: Optional[int] = None,
    retry_delay: Optional[float] = None,
) -> feedparser.FeedParserDict:
    """
    Retrieves and parses an RSS or Atom feed with controlled retries.

    Features:
    - Configurable timeout and retry bounds
    - Exponential backoff on temporary failures (network timeouts, 5xx server errors, 429)
    - Immediate failure on permanent client errors (400, 401, 403, 404, 410, etc.) without wasted retries
    - Diagnostic tracking of retries count attached to returned FeedParserDict (or exception)
    - Supports injecting raw_xml directly for offline testing
    """
    if raw_xml is not None:
        feed = feedparser.parse(raw_xml)
        feed.retries_count = 0
        if feed.bozo == 1 and not feed.entries and not feed.feed.get("title"):
            bozo_exc = getattr(feed, "bozo_exception", "Invalid or malformed feed XML")
            raise ValueError(f"Failed to parse feed data: {bozo_exc}")
        return feed

    effective_timeout = timeout or settings.RSS_FEED_TIMEOUT_SECONDS
    effective_max_retries = (
        max_retries if max_retries is not None else settings.RSS_MAX_RETRIES
    )
    effective_retry_delay = (
        retry_delay if retry_delay is not None else settings.RSS_RETRY_BACKOFF_SECONDS
    )

    max_attempts = 1 + max(0, effective_max_retries)
    retries_attempted = 0

    for attempt in range(1, max_attempts + 1):
        if attempt > 1:
            retries_attempted += 1
            backoff = effective_retry_delay * (2 ** (attempt - 2))
            logger.warning(
                "Retrying feed fetch for %s (attempt %d/%d) after %.2fs backoff",
                feed_url,
                attempt,
                max_attempts,
                backoff,
            )
            time.sleep(backoff)

        try:
            response = httpx.get(
                feed_url,
                timeout=float(effective_timeout),
                headers={"User-Agent": settings.RSS_USER_AGENT},
                follow_redirects=True,
            )

            # Check status code for permanent client errors
            status_code = response.status_code
            if status_code in PERMANENT_HTTP_STATUS_CODES:
                err = RuntimeError(
                    f"HTTP error {status_code}: Permanent error, not retrying ({feed_url})"
                )
                setattr(err, "retries_attempted", retries_attempted)
                raise err

            response.raise_for_status()

            # Successfully received HTTP response, parse XML
            feed = feedparser.parse(response.content)

            # Check if XML is malformed
            if feed.bozo == 1 and not feed.entries and not feed.feed.get("title"):
                bozo_exc = getattr(feed, "bozo_exception", "Invalid or malformed feed XML")
                err = ValueError(f"Failed to parse feed data: {bozo_exc}")
                setattr(err, "retries_attempted", retries_attempted)
                raise err

            feed.retries_count = retries_attempted
            return feed

        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in PERMANENT_HTTP_STATUS_CODES:
                err = RuntimeError(
                    f"HTTP error {status_code}: Permanent error, not retrying ({feed_url})"
                )
                setattr(err, "retries_attempted", retries_attempted)
                raise err from exc

            # Retryable server error (5xx, 429)
            if attempt >= max_attempts:
                err = RuntimeError(
                    f"HTTP error {status_code} after {max_attempts} attempts: {exc}"
                )
                setattr(err, "retries_attempted", retries_attempted)
                raise err from exc
            logger.warning(
                "Temporary HTTP error %d on attempt %d/%d for %s",
                status_code,
                attempt,
                max_attempts,
                feed_url,
            )

        except httpx.TimeoutException as exc:
            if attempt >= max_attempts:
                err = TimeoutError(
                    f"Connection timed out after {max_attempts} attempts ({effective_timeout}s timeout): {exc}"
                )
                setattr(err, "retries_attempted", retries_attempted)
                raise err from exc
            logger.warning(
                "Timeout on attempt %d/%d for %s",
                attempt,
                max_attempts,
                feed_url,
            )

        except httpx.RequestError as exc:
            if attempt >= max_attempts:
                err = ConnectionError(
                    f"Network request failed after {max_attempts} attempts: {exc}"
                )
                setattr(err, "retries_attempted", retries_attempted)
                raise err from exc
            logger.warning(
                "Network request error on attempt %d/%d for %s: %s",
                attempt,
                max_attempts,
                feed_url,
                exc,
            )

    err = RuntimeError(f"Failed to fetch feed {feed_url} after {max_attempts} attempts")
    setattr(err, "retries_attempted", retries_attempted)
    raise err


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
    timeout: Optional[int] = None,
    max_retries: Optional[int] = None,
    retry_delay: Optional[float] = None,
) -> FeedResultDetail:
    """
    Ingests articles from a single configured RSS feed into PostgreSQL.
    - Normalizes canonical URLs and preserves original URLs
    - Deduplicates by canonical URL, original URL, in-memory cache, and exact-content hash
    - Catches concurrent insert collisions using transaction savepoints (begin_nested)
    - Records retries and diagnostic errors safely
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
            retries_attempted=0,
            error="Missing feed_url in configuration",
        )

    articles_inserted = 0
    articles_skipped_duplicate = 0
    seen_urls_in_run: Set[str] = set()
    seen_hashes_in_run: Set[str] = set()
    retries_count = 0

    try:
        # 1. Resolve or create parent NewsSource
        source = get_or_create_news_source(db, source_name=source_name, base_url=base_url)

        # 2. Fetch and parse feed entries with retries
        feed = fetch_and_parse_feed(
            feed_url=feed_url,
            raw_xml=raw_xml,
            timeout=timeout,
            max_retries=max_retries,
            retry_delay=retry_delay,
        )
        retries_count = getattr(feed, "retries_count", 0)

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

            raw_url = raw_link.strip()
            canonical_url = normalize_url(raw_url)
            if not canonical_url:
                continue

            # In-memory deduplication for the current run
            if canonical_url in seen_urls_in_run:
                articles_skipped_duplicate += 1
                continue

            # Database deduplication: check canonical_url or raw url
            existing_article = (
                db.query(Article)
                .filter(
                    (Article.canonical_url == canonical_url)
                    | (Article.url == canonical_url)
                    | (Article.url == raw_url)
                )
                .first()
            )
            if existing_article:
                seen_urls_in_run.add(canonical_url)
                articles_skipped_duplicate += 1
                continue

            # Parse content and content availability
            content, content_availability = extract_entry_content(entry)
            content_hash = compute_content_hash(content)

            # Exact-content hash deduplication for articles from the same source
            if content_hash:
                if content_hash in seen_hashes_in_run:
                    seen_urls_in_run.add(canonical_url)
                    articles_skipped_duplicate += 1
                    continue

                if content and len(content.strip()) >= 50:
                    existing_by_hash = (
                        db.query(Article)
                        .filter(
                            Article.content_hash == content_hash,
                            Article.source_id == source.id,
                        )
                        .first()
                    )
                    if existing_by_hash:
                        seen_urls_in_run.add(canonical_url)
                        seen_hashes_in_run.add(content_hash)
                        articles_skipped_duplicate += 1
                        continue

            # Parse Title with fallback
            raw_title = entry.get("title")
            cleaned_title = clean_html_text(raw_title)
            if not cleaned_title:
                summary_snippet = clean_html_text(entry.get("summary") or entry.get("description"))
                cleaned_title = summary_snippet[:80] + "..." if summary_snippet else "Untitled Article"

            title = cleaned_title[:512]

            # Parse publication timestamp
            published_at = parse_entry_published_at(entry)
            retrieved_at = datetime.now(timezone.utc)

            # Create Article record:
            # url: original article link from RSS feed
            # canonical_url: normalized canonical URL
            article = Article(
                source_id=source.id,
                title=title,
                content=content,
                url=raw_url[:1024],
                canonical_url=canonical_url[:1024],
                content_availability=content_availability,
                content_hash=content_hash,
                published_at=published_at,
                retrieved_at=retrieved_at,
            )

            # Safe database insertion using nested savepoint for concurrency safety
            try:
                with db.begin_nested():
                    db.add(article)
                    db.flush()
                seen_urls_in_run.add(canonical_url)
                if content_hash:
                    seen_hashes_in_run.add(content_hash)
                articles_inserted += 1
            except IntegrityError:
                # Concurrent insert or uniqueness conflict safely caught by savepoint
                articles_skipped_duplicate += 1
                seen_urls_in_run.add(canonical_url)
                if content_hash:
                    seen_hashes_in_run.add(content_hash)

        # Commit all successfully inserted articles for this feed
        db.commit()

        return FeedResultDetail(
            source_name=source.name,
            feed_url=feed_url,
            status="success",
            articles_inserted=articles_inserted,
            articles_skipped_duplicate=articles_skipped_duplicate,
            retries_attempted=retries_count,
            error=None,
        )

    except Exception as exc:
        db.rollback()
        retries_attempted = getattr(exc, "retries_attempted", retries_count)
        logger.error("Error ingesting feed %s (after %d retries): %s", feed_url, retries_attempted, exc)
        return FeedResultDetail(
            source_name=source_name,
            feed_url=feed_url,
            status="error",
            articles_inserted=0,
            articles_skipped_duplicate=0,
            retries_attempted=retries_attempted,
            error=str(exc),
        )


def run_rss_ingestion(
    db: Session,
    feeds: Optional[List[Dict[str, str]]] = None,
    max_articles_per_feed: Optional[int] = None,
    timeout: Optional[int] = None,
    max_retries: Optional[int] = None,
    retry_delay: Optional[float] = None,
    raw_feeds: Optional[Dict[str, str | bytes]] = None,
) -> IngestionSummaryResponse:
    """
    Executes the ingestion pipeline across all configured or supplied feeds.
    Fault-tolerant: a failure in one feed does not stop remaining feeds from processing.
    """
    feed_list = feeds if feeds is not None else DEFAULT_RSS_FEEDS
    effective_timeout = timeout or settings.RSS_FEED_TIMEOUT_SECONDS
    effective_limit = max_articles_per_feed or settings.RSS_MAX_ARTICLES_PER_FEED
    effective_max_retries = max_retries if max_retries is not None else settings.RSS_MAX_RETRIES
    effective_retry_delay = retry_delay if retry_delay is not None else settings.RSS_RETRY_BACKOFF_SECONDS

    total_attempted = 0
    total_successful = 0
    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    total_retries = 0
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
            max_retries=effective_max_retries,
            retry_delay=effective_retry_delay,
        )

        details.append(detail)
        total_retries += detail.retries_attempted
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
        feed_retries=total_retries,
        details=details,
    )
