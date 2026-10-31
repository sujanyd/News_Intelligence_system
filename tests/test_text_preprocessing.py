"""
Tests for Article Text Preprocessing Pipeline.

Validates:
1. Normal text processing without altering meaning or vocabulary.
2. Extra whitespace normalization (leading/trailing, multiple inline spaces, tabs, carriage returns).
3. Paragraph preservation in body text (double newlines preserved, excess collapsed).
4. Missing title handling (fallback to 'Untitled Article' without crashing).
5. Missing content handling (empty string, content_availability set to 'headline_only', is_body_available False).
6. Summary-only vs. full-text articles.
7. Headline-only articles.
8. Preservation of names, dates, numbers, financial symbols, percentages, and punctuation.
9. HTML markup stripping and entity decoding (&amp;, &#8217;, &quot;, &lt;, etc.).
10. Typographical quotes, dashes, and Unicode character normalization.
11. Safe non-destructive processing: original Article ORM instances and dicts remain completely unchanged.
12. get_embedding_input() helper formats for headline, body, and combined targets.
"""

import pytest

from app.models.article import Article
from app.models.news_source import NewsSource
from app.services.text_preprocessing import (
    ProcessedArticleText,
    preprocess_article,
    preprocess_headline,
    preprocess_body,
    normalize_whitespace,
    clean_unicode_and_quotes,
    strip_markup_and_entities,
)


class TestTextPreprocessingCleaningHelpers:
    """Tests for low-level cleaning and normalization utility functions."""

    def test_strip_markup_and_entities_removes_tags_and_decodes(self):
        """Removes script, style, HTML tags, and unescapes HTML entities."""
        raw = '<p>The president &amp; CEO said: &quot;Inflation is down 2.5% in Q3.&quot;<style>.hide { display:none; }</style></p>'
        cleaned = strip_markup_and_entities(raw)
        assert "<p>" not in cleaned
        assert "<style>" not in cleaned
        assert 'The president & CEO said: "Inflation is down 2.5% in Q3."' in cleaned

    def test_strip_markup_none_and_empty(self):
        """Gracefully handles None, empty strings, and non-string inputs."""
        assert strip_markup_and_entities(None) == ""
        assert strip_markup_and_entities("") == ""
        assert strip_markup_and_entities("   ") == "   "

    def test_clean_unicode_and_quotes(self):
        """Converts curly/smart quotes and special dashes while preserving text meaning."""
        raw = "‘Good morning,’ said the minister—who announced “Record $50B Budget” in Geneva."
        cleaned = clean_unicode_and_quotes(raw)
        assert "'" in cleaned
        assert '"' in cleaned
        assert "‘" not in cleaned
        assert "”" not in cleaned
        assert " - " in cleaned
        assert "$50B" in cleaned
        assert "Geneva" in cleaned

    def test_normalize_whitespace_inline(self):
        """Collapses tabs, spaces, and repeated newlines into single spaces for headlines."""
        raw = "   Breaking:    Massive   storm   hits   coastal    regions! \n\n  "
        assert normalize_whitespace(raw, preserve_paragraphs=False) == "Breaking: Massive storm hits coastal regions!"

    def test_normalize_whitespace_preserve_paragraphs(self):
        """Preserves paragraph breaks (\n\n) while collapsing redundant spaces and >2 newlines."""
        raw = "First paragraph line 1.   Still first paragraph.\n\n\n\n\nSecond paragraph starts here.   \n   More line."
        result = normalize_whitespace(raw, preserve_paragraphs=True)
        assert result == "First paragraph line 1. Still first paragraph.\n\nSecond paragraph starts here.\nMore line."


class TestHeadlinePreprocessing:
    """Tests for preprocess_headline()."""

    def test_normal_headline(self):
        """Standard news headline is trimmed and preserved intact."""
        title = "Federal Reserve Holds Key Interest Rate Steady at 5.25%"
        processed = preprocess_headline(title)
        assert processed == "Federal Reserve Holds Key Interest Rate Steady at 5.25%"

    def test_headline_with_extra_whitespace_and_html(self):
        """Strips HTML tags, collapses newlines, and trims spaces."""
        raw = "  <h1>Breaking:  EU   Passes  Historic <b>AI Act</b> \n Regulations</h1>   "
        assert preprocess_headline(raw) == "Breaking: EU Passes Historic AI Act Regulations"

    def test_missing_headline_fallback(self):
        """None, empty string, or whitespace-only headlines fall back to 'Untitled Article'."""
        assert preprocess_headline(None) == "Untitled Article"
        assert preprocess_headline("") == "Untitled Article"
        assert preprocess_headline("   \n\t   ") == "Untitled Article"

    def test_headline_preserves_numbers_names_dates(self):
        """Preserves names (Dr. Jane Doe), dates (Oct 31, 2026), acronyms (NATO, NASA), and figures ($1.2B)."""
        raw = "NASA & ESA Launch $1.2B Deep Space Telescope on Oct 31, 2026"
        assert preprocess_headline(raw) == "NASA & ESA Launch $1.2B Deep Space Telescope on Oct 31, 2026"


class TestBodyPreprocessing:
    """Tests for preprocess_body()."""

    def test_normal_body_content(self):
        """Full body content is cleaned with paragraph structure intact."""
        raw = (
            "<p>GENEVA - Delegates from 45 countries convened on Monday for trade negotiations.</p>"
            "<p>The summit aims to address supply chain bottlenecks and tariffs on renewable technology.</p>"
        )
        body, availability, is_available = preprocess_body(raw, content_availability="full_text")
        assert is_available is True
        assert availability == "full_text"
        assert "GENEVA - Delegates from 45 countries convened" in body
        assert "\n\n" in body  # Paragraph preserved
        assert "The summit aims to address" in body

    def test_missing_content(self):
        """None or empty content returns empty body, headline_only status, and is_body_available=False."""
        body, availability, is_available = preprocess_body(None, content_availability="full_text")
        assert body == ""
        assert availability == "headline_only"
        assert is_available is False

        body2, availability2, is_available2 = preprocess_body("   <p></p>   ", content_availability="summary_only")
        assert body2 == ""
        assert availability2 == "headline_only"
        assert is_available2 is False

    def test_summary_only_preservation(self):
        """Summary-only articles maintain 'summary_only' availability flag."""
        summary = "Short briefing on quarterly earnings released by the finance ministry."
        body, availability, is_available = preprocess_body(summary, content_availability="summary_only")
        assert is_available is True
        assert availability == "summary_only"
        assert body == summary


class TestFullArticlePreprocessingPipeline:
    """Integration tests for preprocess_article() universal entrypoint."""

    def test_preprocess_article_from_orm_instance(self, db_session):
        """Preprocesses an Article ORM instance safely without mutating original database record."""
        source = NewsSource(name="Global Financial Press", base_url="https://gfp.org")
        db_session.add(source)
        db_session.flush()

        original_title = "   <b>Tech Giant Reports $95.4B</b>  Revenue for Q3 2026   "
        original_content = (
            "<p>SAN FRANCISCO - Cloud infrastructure growth accelerated by 34% this quarter.</p>\n\n"
            "<p>CEO Satya Nadella commented: &quot;Enterprise AI adoption is driving unprecedented workload expansion.&quot;</p>"
        )

        article = Article(
            source_id=source.id,
            title=original_title,
            content=original_content,
            url="https://gfp.org/tech/earnings-q3-2026",
            canonical_url="https://gfp.org/tech/earnings-q3-2026",
            content_availability="full_text",
        )
        db_session.add(article)
        db_session.commit()

        # Run preprocessing
        processed: ProcessedArticleText = preprocess_article(article)

        # 1. Headline verified
        assert processed.headline == "Tech Giant Reports $95.4B Revenue for Q3 2026"

        # 2. Body text verified
        assert "SAN FRANCISCO - Cloud infrastructure growth accelerated by 34%" in processed.body
        assert 'CEO Satya Nadella commented: "Enterprise AI adoption' in processed.body
        assert processed.is_body_available is True
        assert processed.content_availability == "full_text"
        assert processed.word_count > 15
        assert processed.character_count > 100

        # 3. CRITICAL: Original database model attributes remain completely untouched!
        assert article.title == original_title
        assert article.content == original_content
        assert article.content_availability == "full_text"

    def test_preprocess_article_from_dict(self):
        """Accepts dictionary inputs for raw scraper outputs or test payloads."""
        article_dict = {
            "title": "  Diplomats Sign Treaty   in   Vienna  ",
            "content": "Official ceremonies concluded at 14:00 CET on October 31, 2026.",
            "content_availability": "summary_only",
        }
        processed = preprocess_article(article_dict)
        assert processed.headline == "Diplomats Sign Treaty in Vienna"
        assert processed.body == "Official ceremonies concluded at 14:00 CET on October 31, 2026."
        assert processed.content_availability == "summary_only"
        assert processed.is_body_available is True

        # Input dictionary was not modified
        assert article_dict["title"] == "  Diplomats Sign Treaty   in   Vienna  "

    def test_preprocess_article_headline_only(self):
        """Handles headline-only articles where content is missing."""
        processed = preprocess_article(
            article_or_title="Flash Alert: Earthquake Detected Near Tokyo",
            raw_content=None,
            content_availability="headline_only",
        )
        assert processed.headline == "Flash Alert: Earthquake Detected Near Tokyo"
        assert processed.body == ""
        assert processed.is_body_available is False
        assert processed.content_availability == "headline_only"

    def test_preprocess_article_preserves_sensitive_news_entities(self):
        """
        Confirms preprocessing preserves names, hyphenated terms, statistics,
        percentages, currencies, dates, and quotes essential for bias analysis.
        """
        raw_title = "President O'Connor's 2026 Economic Plan: $450M for High-Speed Rail"
        raw_body = (
            "WASHINGTON - On November 1st, 2026, the administration proposed a 15.5% tax incentive. "
            "Critics from the opposition party called it 'fiscally reckless,' while co-sponsors praised the bi-partisan effort."
        )
        processed = preprocess_article(article_or_title=raw_title, raw_content=raw_body)

        # Check title preservation
        assert "O'Connor's" in processed.headline
        assert "$450M" in processed.headline
        assert "High-Speed" in processed.headline

        # Check body preservation
        assert "November 1st, 2026" in processed.body
        assert "15.5%" in processed.body
        assert "'fiscally reckless,'" in processed.body
        assert "bi-partisan" in processed.body

    def test_get_embedding_input_targets(self):
        """Verifies get_embedding_input() outputs tailored strings for headline, body, and combined modes."""
        processed = preprocess_article(
            article_or_title="Headline Announcement",
            raw_content="Body text detail explaining the announcement in full.",
        )

        assert processed.get_embedding_input(target="headline") == "Headline Announcement"
        assert processed.get_embedding_input(target="body") == "Body text detail explaining the announcement in full."
        assert (
            processed.get_embedding_input(target="combined")
            == "Headline: Headline Announcement\n\nBody: Body text detail explaining the announcement in full."
        )

    def test_get_embedding_input_body_fallback_when_empty(self):
        """When body is missing, target='body' safely falls back to headline instead of returning empty."""
        processed = preprocess_article(
            article_or_title="Only Headline Available",
            raw_content="",
            content_availability="headline_only",
        )
        assert processed.get_embedding_input(target="headline") == "Only Headline Available"
        # Falls back to headline so embedding model does not receive empty string
        assert processed.get_embedding_input(target="body") == "Only Headline Available"
        assert processed.get_embedding_input(target="combined") == "Headline: Only Headline Available"

    def test_get_embedding_input_invalid_target_raises_error(self):
        """Invalid target name raises ValueError with descriptive message."""
        processed = preprocess_article("Title", "Content")
        with pytest.raises(ValueError, match="Unknown embedding target"):
            processed.get_embedding_input(target="invalid_target")
