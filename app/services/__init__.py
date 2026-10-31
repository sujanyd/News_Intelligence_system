"""
Services package.

Contains business logic, NLP processing, news bias detection algorithms,
and framing classification services. Keeping business logic here keeps
API routes thin, readable, and easy to test.
"""

from app.services.text_preprocessing import (
    ProcessedArticleText,
    preprocess_article,
    preprocess_headline,
    preprocess_body,
    normalize_whitespace,
    clean_unicode_and_quotes,
    strip_markup_and_entities,
)

__all__ = [
    "ProcessedArticleText",
    "preprocess_article",
    "preprocess_headline",
    "preprocess_body",
    "normalize_whitespace",
    "clean_unicode_and_quotes",
    "strip_markup_and_entities",
]

