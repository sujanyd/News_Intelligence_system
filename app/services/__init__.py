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
from app.services.embedding import (
    BaseEmbeddingProvider,
    GeneratedVector,
    MockEmbeddingProvider,
    OpenAIEmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
    generate_article_embedding,
    run_article_embedding_generation,
    normalize_embedding_type,
)

from app.services.vector_db import (
    VectorDatabaseService,
    VectorSearchResult,
    get_vector_db_service,
    set_vector_db_service,
)
from app.services.similarity import (
    SimilaritySearchService,
    ArticleSimilarityMatch,
    ArticleSimilarityResponse,
    get_similarity_service,
)

__all__ = [
    "ProcessedArticleText",
    "preprocess_article",
    "preprocess_headline",
    "preprocess_body",
    "normalize_whitespace",
    "clean_unicode_and_quotes",
    "strip_markup_and_entities",
    "BaseEmbeddingProvider",
    "GeneratedVector",
    "MockEmbeddingProvider",
    "OpenAIEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "get_embedding_provider",
    "generate_article_embedding",
    "run_article_embedding_generation",
    "normalize_embedding_type",
    "VectorDatabaseService",
    "VectorSearchResult",
    "get_vector_db_service",
    "set_vector_db_service",
    "SimilaritySearchService",
    "ArticleSimilarityMatch",
    "ArticleSimilarityResponse",
    "get_similarity_service",
]

