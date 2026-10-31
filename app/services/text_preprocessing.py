"""
Article Text Preprocessing Service.

Prepares and normalizes news article text for downstream NLP tasks:
- Embedding generation (headline embeddings and body embeddings)
- Semantic similarity clustering (story grouping and deduplication)
- Bias, framing, and sentiment analysis

Key Design Principles:
1. Meaning Preservation: Does not remove named entities, dates, numbers, punctuation,
   or domain-specific terminology essential to framing and bias detection.
2. Safe Cleaning: Strips residual markup/HTML, decodes HTML entities, fixes smart quotes
   and non-breaking spaces, and collapses excessive whitespace while keeping paragraph structure.
3. Task Separation: Prepares separate, dedicated representations for headline embedding
   and body/content analysis without blindly combining them.
4. Non-Destructive: Never modifies or overwrites the original Article records in the database.
"""

from dataclasses import dataclass
import html
import re
import unicodedata
from typing import Optional, Union

from app.models.article import Article
from app.schemas.article import ArticleDetailResponse, ArticleSummaryResponse


@dataclass(frozen=True)
class ProcessedArticleText:
    """
    Structured container for preprocessed article text.

    Attributes:
        headline: Normalized title/headline optimized for headline embedding and comparison.
        body: Normalized body/content text. Falls back to summary if full text is unavailable.
        content_availability: Content availability status ('full_text', 'summary_only', 'headline_only').
        is_body_available: True if body text (full text or summary) is present and non-empty.
        word_count: Total word count across processed headline and body.
        character_count: Total character count across processed headline and body.
        original_title: Preserved original raw title before preprocessing.
        original_content: Preserved original raw content before preprocessing.
    """

    headline: str
    body: str
    content_availability: str
    is_body_available: bool
    word_count: int
    character_count: int
    original_title: Optional[str] = None
    original_content: Optional[str] = None

    def get_embedding_input(self, target: str = "body") -> str:
        """
        Returns text formatted specifically for vector embedding models.

        Args:
            target: 'headline' for title embeddings,
                    'body' for body embeddings (falls back to headline if body empty),
                    'combined' for contextualized representation 'Headline: ...\\n\\nBody: ...'
        """
        if target == "headline":
            return self.headline
        elif target == "body":
            return self.body if self.is_body_available else self.headline
        elif target == "combined":
            if self.is_body_available:
                return f"Headline: {self.headline}\n\nBody: {self.body}"
            return f"Headline: {self.headline}"
        else:
            raise ValueError(f"Unknown embedding target: {target}. Choose 'headline', 'body', or 'combined'.")


def clean_unicode_and_quotes(text: str) -> str:
    """
    Normalizes Unicode representation (NFKC) and unifies typographical quotes/spaces
    while preserving letters, accents, numbers, and grammatical punctuation.
    """
    if not text:
        return ""

    # Normalize unicode to NFKC (composes characters and decomposes compatibility forms)
    normalized = unicodedata.normalize("NFKC", text)

    # Convert non-breaking spaces, zero-width spaces, and other exotic spaces to standard space
    normalized = re.sub(r"[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]", " ", normalized)

    # Replace typographical / curly quotes with standard equivalents to avoid model token divergence
    # Quotes: ‘ ’ ‚ ‛ -> ', “ ” „ ‟ -> "
    normalized = re.sub(r"[\u2018\u2019\u201A\u201B]", "'", normalized)
    normalized = re.sub(r"[\u201C\u201D\u201E\u201F]", '"', normalized)

    # Dashes: em-dash, en-dash, figure dash, horizontal bar -> standard dash with space preservation
    # We preserve hyphens for compound words (e.g., 'cost-effective') and dashes for sentence clauses
    normalized = normalized.replace("—", " - ").replace("–", " - ").replace("―", " - ")

    return normalized


def strip_markup_and_entities(raw_text: Optional[str]) -> str:
    """
    Safely strips HTML tags and decodes HTML entities without altering the underlying prose.
    Converts block closing tags (</p>, </div>, <br>, </h1>-</h6>, </li>) to newlines so that
    paragraph boundaries are preserved.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    # Strip script and style blocks if present
    cleaned = re.sub(r"<script[^>]*>.*?</script>", "", raw_text, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<style[^>]*>.*?</style>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)

    # Convert block tags to paragraph breaks before stripping
    cleaned = re.sub(r"</(?:p|div|h[1-6]|tr|article|section)>", "\n\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<(?:br|hr)[^>]*>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"</li>", "\n", cleaned, flags=re.IGNORECASE)

    # Strip remaining HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)

    # Decode HTML entities (e.g. &amp; -> &, &#8217; -> ', &quot; -> ")
    cleaned = html.unescape(cleaned)

    return cleaned


def normalize_whitespace(text: str, preserve_paragraphs: bool = False) -> str:
    """
    Collapses repeated whitespace and strips leading/trailing space.

    Args:
        text: Input string.
        preserve_paragraphs: If True, preserves double newlines (paragraphs) while collapsing
                             redundant inline spaces and excess newlines (>2).
    """
    if not text:
        return ""

    if preserve_paragraphs:
        # Standardize carriage returns
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse spaces and tabs on each line
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse 3 or more consecutive newlines into 2 (paragraph break)
        text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
        # Strip trailing/leading spaces on each individual line
        lines = [line.strip() for line in text.split("\n")]
        text = "\n".join(lines)
        return text.strip()
    else:
        # Collapse all whitespace sequences into a single space
        return re.sub(r"\s+", " ", text).strip()


def preprocess_headline(raw_title: Optional[str]) -> str:
    """
    Preprocesses news article headlines for embedding and matching.

    - Handles missing or empty titles safely with fallback.
    - Strips markup and decodes HTML entities.
    - Cleans typographical quotes and Unicode.
    - Normalizes inline whitespace into a single line.
    - Preserves all names, numbers, dates, and punctuation.
    """
    if not raw_title or not isinstance(raw_title, str):
        return "Untitled Article"

    cleaned = strip_markup_and_entities(raw_title)
    cleaned = clean_unicode_and_quotes(cleaned)
    normalized = normalize_whitespace(cleaned, preserve_paragraphs=False)

    return normalized if normalized else "Untitled Article"


def preprocess_body(
    raw_content: Optional[str],
    content_availability: str = "full_text",
) -> tuple[str, str, bool]:
    """
    Preprocesses news article body content or summary.

    Args:
        raw_content: Raw text or summary from feed or scraper.
        content_availability: Current availability status ('full_text', 'summary_only', 'headline_only').

    Returns:
        tuple of (processed_body_text, resolved_availability, is_body_available)
    """
    if not raw_content or not isinstance(raw_content, str):
        return "", "headline_only", False

    cleaned = strip_markup_and_entities(raw_content)
    cleaned = clean_unicode_and_quotes(cleaned)
    normalized = normalize_whitespace(cleaned, preserve_paragraphs=True)

    if not normalized:
        return "", "headline_only", False

    # Check whether the resolved text is substantial
    resolved_availability = content_availability
    if resolved_availability == "headline_only":
        resolved_availability = "summary_only"

    return normalized, resolved_availability, True


def preprocess_article(
    article_or_title: Union[Article, ArticleDetailResponse, ArticleSummaryResponse, dict, str, None],
    raw_content: Optional[str] = None,
    content_availability: Optional[str] = None,
) -> ProcessedArticleText:
    """
    Universal preprocessing pipeline entrypoint.

    Accepts an Article ORM instance, Pydantic schema, dictionary, or raw title and content strings.
    Extracts, cleans, and structures headline and body text separately without altering original data.
    """
    raw_title: Optional[str] = None
    raw_body: Optional[str] = None
    availability: str = "full_text"

    # Extract fields based on input type
    if isinstance(article_or_title, Article):
        raw_title = article_or_title.title
        raw_body = article_or_title.content
        availability = article_or_title.content_availability or "full_text"
    elif isinstance(article_or_title, (ArticleDetailResponse, ArticleSummaryResponse)):
        raw_title = article_or_title.title
        raw_body = getattr(article_or_title, "content", None)
        availability = article_or_title.content_availability or "full_text"
    elif isinstance(article_or_title, dict):
        raw_title = article_or_title.get("title")
        raw_body = article_or_title.get("content")
        availability = article_or_title.get("content_availability") or "full_text"
    elif isinstance(article_or_title, str) or article_or_title is None:
        raw_title = article_or_title
        raw_body = raw_content
        availability = content_availability or ("full_text" if raw_content else "headline_only")
    else:
        # Fallback for duck typing (any object with title/content attributes)
        raw_title = getattr(article_or_title, "title", None)
        raw_body = getattr(article_or_title, "content", None)
        availability = getattr(article_or_title, "content_availability", "full_text")

    # If explicit raw_content or availability were passed, let them override
    if raw_content is not None and not isinstance(article_or_title, (str, type(None))):
        raw_body = raw_content
    if content_availability is not None:
        availability = content_availability

    # 1. Process Headline
    processed_headline = preprocess_headline(raw_title)

    # 2. Process Body
    processed_body, resolved_availability, is_body_available = preprocess_body(
        raw_body, content_availability=availability
    )

    # 3. Calculate word and character statistics
    total_text = f"{processed_headline} {processed_body}".strip()
    word_count = len(total_text.split()) if total_text else 0
    character_count = len(total_text)

    return ProcessedArticleText(
        headline=processed_headline,
        body=processed_body,
        content_availability=resolved_availability,
        is_body_available=is_body_available,
        word_count=word_count,
        character_count=character_count,
        original_title=raw_title,
        original_content=raw_body,
    )
