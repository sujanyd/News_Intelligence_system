"""
Tests for RSS Feed Ingestion Service and API Endpoints.

Validates:
1. URL normalization (tracking param removal, lowercase domain, path cleanup).
2. Content hash and HTML cleaning.
3. Publication date and content availability extraction.
4. Single and multiple feed ingestion into the database.
5. Missing and invalid field handling (missing title, URL, date).
6. Deduplication on repeated feed runs and canonical URLs.
7. Fault tolerance (one failing feed does not prevent other feeds from succeeding).
8. API endpoints (POST /api/ingestion/run, POST /api/v1/ingestion/run, GET /api/ingestion/feeds).
"""

from datetime import datetime, timezone
import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.models.article import Article
from app.models.news_source import NewsSource
from app.services.rss_ingestion import (
    clean_html_text,
    compute_content_hash,
    extract_entry_content,
    normalize_url,
    parse_entry_published_at,
    ingest_single_feed,
    run_rss_ingestion,
)


# =============================================================================
# Sample Feed XML Fixtures
# =============================================================================

SAMPLE_RSS_2 = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Global Wire News</title>
    <link>https://www.globalwire.com</link>
    <description>Global breaking news feed</description>
    <item>
      <title>Leaders Convene for Landmark Trade Summit</title>
      <link>https://www.globalwire.com/news/trade-summit-2026?utm_source=rss&amp;utm_medium=feed</link>
      <description>&lt;p&gt;Ministers from 40 nations gathered in Geneva to negotiate tariff reductions.&lt;/p&gt;</description>
      <pubDate>Thu, 29 Oct 2026 10:15:00 GMT</pubDate>
    </item>
    <item>
      <title>Renewable Capacity Surpasses Forecasts</title>
      <link>https://www.globalwire.com/tech/renewable-energy-record?ref=homepage</link>
      <description>Solar and wind generation reached record highs across the continent this quarter.</description>
      <pubDate>Thu, 29 Oct 2026 12:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""

SAMPLE_ATOM_FEED = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Tech Dispatch</title>
  <link href="https://techdispatch.io"/>
  <updated>2026-10-29T08:00:00Z</updated>
  <entry>
    <title>Quantum Processor Achieves Key Milestone</title>
    <link href="https://techdispatch.io/articles/quantum-breakthrough?fbclid=xyz987"/>
    <id>urn:uuid:12345678-abcd-ef01-2345-6789abcdef01</id>
    <updated>2026-10-29T08:00:00Z</updated>
    <summary>Researchers announced a breakthrough in quantum error correction.</summary>
    <content type="html">&lt;div&gt;&lt;p&gt;A multidisciplinary research consortium has successfully demonstrated fault-tolerant logical qubits capable of sustaining coherence through rigorous experimental benchmarks.&lt;/p&gt;&lt;p&gt;The findings were published Thursday in physical review letters.&lt;/p&gt;&lt;/div&gt;</content>
  </entry>
</feed>
"""

SAMPLE_FEED_WITH_EDGE_CASES = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Edge Cases Daily</title>
    <link>https://www.edgecases.org</link>
    <description>Testing edge case scenarios</description>
    <!-- Entry 1: Missing title (should fallback to summary snippet) -->
    <item>
      <link>https://www.edgecases.org/news/no-title-article</link>
      <description>Summary snippet for an article that arrived without any headline title.</description>
      <pubDate>Thu, 29 Oct 2026 09:00:00 GMT</pubDate>
    </item>
    <!-- Entry 2: Missing link (invalid; must be skipped) -->
    <item>
      <title>Article Missing Link</title>
      <description>This item has no link and cannot be stored.</description>
      <pubDate>Thu, 29 Oct 2026 09:05:00 GMT</pubDate>
    </item>
    <!-- Entry 3: Missing pubDate (published_at should be None) -->
    <item>
      <title>Timeless Innovation Announcement</title>
      <link>https://www.edgecases.org/news/timeless-article</link>
      <description>This article contains no publication date timestamp.</description>
    </item>
    <!-- Entry 4: Headline only (no summary or content) -->
    <item>
      <title>Just a Quick Headline Alert</title>
      <link>https://www.edgecases.org/news/headline-only-alert</link>
      <pubDate>Thu, 29 Oct 2026 09:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""

SAMPLE_MALFORMED_XML = """This is totally not valid XML or RSS data at all! <<<>>>"""

SAMPLE_API_WIRE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>API Wire News</title>
    <link>https://apiwire.com</link>
    <description>API wire news feed</description>
    <item>
      <title>API Article Headline 1</title>
      <link>https://apiwire.com/news/api-exclusive-1</link>
      <description>Summary of article 1 from API wire.</description>
      <pubDate>Thu, 29 Oct 2026 15:00:00 GMT</pubDate>
    </item>
    <item>
      <title>API Article Headline 2</title>
      <link>https://apiwire.com/news/api-exclusive-2</link>
      <description>Summary of article 2 from API wire.</description>
      <pubDate>Thu, 29 Oct 2026 15:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""


# =============================================================================
# Unit Tests: Helper Functions
# =============================================================================

class TestIngestionHelpers:
    """Tests for URL normalization, content hashing, and text parsing helpers."""

    def test_normalize_url_strips_tracking_params(self):
        """Ensures common analytics query params are stripped."""
        raw = "https://example.com/news/article-1?utm_source=twitter&utm_medium=social&b=2&a=1#section"
        expected = "https://example.com/news/article-1?a=1&b=2"
        assert normalize_url(raw) == expected

    def test_normalize_url_lowercases_host_and_scheme(self):
        """Host and scheme should be lowercased; path case preserved."""
        raw = "HTTPS://Example.COM:443/Path/To/Story/?fbclid=123"
        expected = "https://example.com/Path/To/Story"
        assert normalize_url(raw) == expected

    def test_normalize_url_handles_empty_and_invalid(self):
        """Invalid strings should return gracefully without exceptions."""
        assert normalize_url("") == ""
        assert normalize_url(None) == ""
        assert normalize_url("not-a-valid-url") == "not-a-valid-url"

    def test_compute_content_hash(self):
        """Computes deterministic 64-char hex SHA-256 hash."""
        text = "Breaking news content paragraph."
        h1 = compute_content_hash(text)
        h2 = compute_content_hash(text)
        assert h1 is not None
        assert len(h1) == 64
        assert h1 == h2
        assert compute_content_hash(None) is None
        assert compute_content_hash("") is None

    def test_clean_html_text(self):
        """Removes script, style, HTML tags, unescapes entities, and normalizes spaces."""
        raw = "<p>Scientists &amp; engineers said: &quot;Hello World!&quot;<style>p { color: red; }</style></p>"
        cleaned = clean_html_text(raw)
        assert cleaned == 'Scientists & engineers said: "Hello World!"'

    def test_clean_html_text_none_and_empty(self):
        """Returns None for empty or None inputs."""
        assert clean_html_text(None) is None
        assert clean_html_text("   <p></p>   ") is None

    def test_parse_entry_published_at_rfc2822(self):
        """Parses RFC-2822 date strings."""
        entry = {"published": "Thu, 29 Oct 2026 14:30:00 GMT"}
        dt = parse_entry_published_at(entry)
        assert dt is not None
        assert dt.year == 2026
        assert dt.month == 10
        assert dt.day == 29
        assert dt.hour == 14
        assert dt.minute == 30
        assert dt.tzinfo == timezone.utc

    def test_parse_entry_published_at_invalid_fallback(self):
        """Returns None on invalid date without crashing."""
        entry = {"published": "not-a-real-date-string"}
        assert parse_entry_published_at(entry) is None
        assert parse_entry_published_at({}) is None

    def test_extract_entry_content_full_text(self):
        """Identifies full text when substantial content block is provided."""
        long_body = "A " * 150  # 300 chars
        entry = {"content": [{"value": f"<p>{long_body}</p>"}]}
        content, availability = extract_entry_content(entry)
        assert availability == "full_text"
        assert content is not None

    def test_extract_entry_content_summary_only(self):
        """Identifies summary_only when only description is provided."""
        entry = {"summary": "<p>A concise summary of breaking events.</p>"}
        content, availability = extract_entry_content(entry)
        assert availability == "summary_only"
        assert content == "A concise summary of breaking events."

    def test_extract_entry_content_headline_only(self):
        """Identifies headline_only when neither body nor summary exists."""
        entry = {"title": "Only a Headline"}
        content, availability = extract_entry_content(entry)
        assert availability == "headline_only"
        assert content is None


# =============================================================================
# Integration Tests: Ingestion Service & Database Persistence
# =============================================================================

class TestRSSIngestionService:
    """Tests for feed ingestion, database persistence, and deduplication."""

    def test_ingest_single_feed_success(self, db_session):
        """Valid feed is parsed, NewsSource created, and articles inserted."""
        feed_cfg = {
            "source_name": "Global Wire",
            "base_url": "https://www.globalwire.com",
            "feed_url": "https://www.globalwire.com/rss.xml",
        }

        result = ingest_single_feed(
            feed_cfg=feed_cfg,
            db=db_session,
            raw_xml=SAMPLE_RSS_2,
        )

        assert result.status == "success"
        assert result.articles_inserted == 2
        assert result.articles_skipped_duplicate == 0
        assert result.error is None

        # Verify source exists in DB
        source = db_session.query(NewsSource).filter_by(name="Global Wire").first()
        assert source is not None
        assert source.base_url == "https://www.globalwire.com"

        # Verify articles in DB
        articles = db_session.query(Article).filter_by(source_id=source.id).all()
        assert len(articles) == 2

        # Check normalization and content availability
        a1 = db_session.query(Article).filter(Article.url.contains("trade-summit-2026")).first()
        assert a1 is not None
        assert a1.source.name == "Global Wire"
        assert "utm_source" not in a1.url
        assert a1.content_availability == "summary_only"
        assert a1.published_at is not None
        assert a1.retrieved_at is not None
        assert a1.content_hash is not None

    def test_duplicate_url_prevention(self, db_session):
        """Running ingestion twice skips duplicate URLs and avoids repeated inserts."""
        feed_cfg = {
            "source_name": "Global Wire",
            "base_url": "https://www.globalwire.com",
            "feed_url": "https://www.globalwire.com/rss.xml",
        }

        # First run: inserts 2 articles
        res1 = ingest_single_feed(feed_cfg=feed_cfg, db=db_session, raw_xml=SAMPLE_RSS_2)
        assert res1.articles_inserted == 2
        assert res1.articles_skipped_duplicate == 0

        # Second run: identical feed -> 0 inserted, 2 skipped
        res2 = ingest_single_feed(feed_cfg=feed_cfg, db=db_session, raw_xml=SAMPLE_RSS_2)
        assert res2.articles_inserted == 0
        assert res2.articles_skipped_duplicate == 2

        # Verify total count in DB remains 2
        total = db_session.query(Article).count()
        assert total == 2

    def test_missing_and_invalid_fields_handled_safely(self, db_session):
        """Safely handles missing title, invalid URL, missing date, and headline-only entries."""
        feed_cfg = {
            "source_name": "Edge Cases Daily",
            "base_url": "https://www.edgecases.org",
            "feed_url": "https://www.edgecases.org/rss.xml",
        }

        result = ingest_single_feed(
            feed_cfg=feed_cfg,
            db=db_session,
            raw_xml=SAMPLE_FEED_WITH_EDGE_CASES,
        )

        assert result.status == "success"
        # 4 entries in fixture: 1 missing URL (skipped), 3 valid entries inserted
        assert result.articles_inserted == 3

        # 1. Missing title: fallback title generated
        no_title_art = db_session.query(Article).filter(Article.url.contains("no-title-article")).first()
        assert no_title_art is not None
        assert no_title_art.title.startswith("Summary snippet")

        # 2. Missing link: should not exist in DB
        missing_link_art = db_session.query(Article).filter_by(title="Article Missing Link").first()
        assert missing_link_art is None

        # 3. Missing pubDate: published_at is None
        timeless_art = db_session.query(Article).filter(Article.url.contains("timeless-article")).first()
        assert timeless_art is not None
        assert timeless_art.published_at is None

        # 4. Headline only: content is None, availability is 'headline_only'
        headline_art = db_session.query(Article).filter(Article.url.contains("headline-only-alert")).first()
        assert headline_art is not None
        assert headline_art.content is None
        assert headline_art.content_availability == "headline_only"

    def test_atom_feed_ingestion(self, db_session):
        """Atom feeds are parsed and full content is correctly stored."""
        feed_cfg = {
            "source_name": "Tech Dispatch",
            "base_url": "https://techdispatch.io",
            "feed_url": "https://techdispatch.io/atom.xml",
        }

        result = ingest_single_feed(
            feed_cfg=feed_cfg,
            db=db_session,
            raw_xml=SAMPLE_ATOM_FEED,
        )

        assert result.status == "success"
        assert result.articles_inserted == 1

        article = db_session.query(Article).filter(Article.url.contains("quantum-breakthrough")).first()
        assert article is not None
        assert article.content_availability == "full_text"
        assert "fbclid" not in article.url
        assert "fault-tolerant logical qubits" in article.content

    def test_multiple_feeds_orchestration(self, db_session):
        """Multiple feeds are processed and associated with distinct news sources."""
        feeds = [
            {
                "source_name": "Global Wire",
                "base_url": "https://www.globalwire.com",
                "feed_url": "https://www.globalwire.com/rss.xml",
            },
            {
                "source_name": "Tech Dispatch",
                "base_url": "https://techdispatch.io",
                "feed_url": "https://techdispatch.io/atom.xml",
            },
        ]
        raw_feeds = {
            "https://www.globalwire.com/rss.xml": SAMPLE_RSS_2,
            "https://techdispatch.io/atom.xml": SAMPLE_ATOM_FEED,
        }

        summary = run_rss_ingestion(
            db=db_session,
            feeds=feeds,
            raw_feeds=raw_feeds,
        )

        assert summary.feeds_attempted == 2
        assert summary.feeds_successful == 2
        assert summary.feed_errors == 0
        assert summary.articles_inserted == 3  # 2 from Global Wire + 1 from Tech Dispatch

        sources_count = db_session.query(NewsSource).count()
        assert sources_count == 2

    def test_failed_feed_does_not_block_successful_feeds(self, db_session):
        """
        Fault tolerance: an unreachable or broken feed fails gracefully
        without preventing other feeds from processing.
        """
        feeds = [
            {
                "source_name": "Broken Feed Outlet",
                "base_url": "https://broken.invalid",
                "feed_url": "https://broken.invalid/rss.xml",
            },
            {
                "source_name": "Global Wire",
                "base_url": "https://www.globalwire.com",
                "feed_url": "https://www.globalwire.com/rss.xml",
            },
        ]
        raw_feeds = {
            "https://broken.invalid/rss.xml": SAMPLE_MALFORMED_XML,
            "https://www.globalwire.com/rss.xml": SAMPLE_RSS_2,
        }

        summary = run_rss_ingestion(
            db=db_session,
            feeds=feeds,
            raw_feeds=raw_feeds,
        )

        assert summary.feeds_attempted == 2
        assert summary.feeds_successful == 1
        assert summary.feed_errors == 1
        assert summary.articles_inserted == 2

        # Check detail records
        err_detail = next(d for d in summary.details if d.source_name == "Broken Feed Outlet")
        assert err_detail.status == "error"
        assert err_detail.error is not None

        succ_detail = next(d for d in summary.details if d.source_name == "Global Wire")
        assert succ_detail.status == "success"
        assert succ_detail.articles_inserted == 2


# =============================================================================
# API Endpoint Tests
# =============================================================================

class TestIngestionAPIEndpoints:
    """Tests for POST /api/ingestion/run and GET /api/ingestion/feeds."""

    @patch("app.services.rss_ingestion.httpx.get")
    def test_api_ingestion_run_success(self, mock_get, client):
        """POST /api/ingestion/run executes ingestion with mocked HTTP responses."""
        mock_response = MagicMock()
        mock_response.content = SAMPLE_API_WIRE_RSS.encode("utf-8")
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        payload = {
            "feeds": [
                {
                    "source_name": "API Wire Source",
                    "base_url": "https://apiwire.com",
                    "feed_url": "https://apiwire.com/rss.xml",
                }
            ],
            "max_articles_per_feed": 5,
        }

        response = client.post("/api/ingestion/run", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["feeds_attempted"] == 1
        assert data["feeds_successful"] == 1
        assert data["articles_inserted"] == 2
        assert data["articles_skipped_duplicate"] == 0
        assert data["feed_errors"] == 0
        assert len(data["details"]) == 1
        assert data["details"][0]["source_name"] == "API Wire Source"

    @patch("app.services.rss_ingestion.httpx.get")
    def test_api_ingestion_network_failure_handling(self, mock_get, client):
        """POST /api/ingestion/run reports network error gracefully without crashing."""
        mock_get.side_effect = httpx.ConnectError("Connection refused by peer")

        payload = {
            "feeds": [
                {
                    "source_name": "Offline Feed",
                    "base_url": "https://offline.example.com",
                    "feed_url": "https://offline.example.com/rss.xml",
                }
            ]
        }

        response = client.post("/api/ingestion/run", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["feeds_attempted"] == 1
        assert data["feeds_successful"] == 0
        assert data["feed_errors"] == 1
        assert data["articles_inserted"] == 0
        assert "Network request failed" in data["details"][0]["error"]

    def test_api_v1_and_api_prefix_parity(self, client):
        """Both /api/ingestion and /api/v1/ingestion paths are available."""
        res_std = client.get("/api/ingestion/feeds")
        res_v1 = client.get("/api/v1/ingestion/feeds")

        assert res_std.status_code == 200
        assert res_v1.status_code == 200
        assert res_std.json() == res_v1.json()
        assert len(res_std.json()) >= 3
