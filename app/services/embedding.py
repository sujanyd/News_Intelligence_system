"""
Article Embedding Service.

Provides a modular, extensible interface for generating vector embeddings
from preprocessed article text (headlines and body content).

Features:
- Configurable providers ('mock', 'openai', 'gemini') controlled by environment variables.
- Separate embedding types: 'headline' (or 'title') and 'body' (or 'content').
- Meaning-preserving text preprocessing before embedding generation.
- Non-destructive execution: never overwrites or mutates original Article data.
- Duplicate prevention: checks existing ArticleEmbedding records before calling models.
- Regeneration support: allows refreshing embeddings when models change.
- Safe handling of missing/empty text: skips without generating meaningless vectors.
- Prepares vector reference IDs and structured results ready for future Qdrant storage.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
import hashlib
import logging
import math
from typing import List, Optional, Tuple, Union
import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.schemas.embedding import (
    ArticleEmbeddingResultDetail,
    EmbeddingGenerateSummaryResponse,
)
from app.services.text_preprocessing import (
    ProcessedArticleText,
    preprocess_article,
)

logger = logging.getLogger(__name__)


# Standardized embedding types accepted across the pipeline
VALID_EMBEDDING_TYPES = {"headline", "body", "title", "content"}


def normalize_embedding_type(emb_type: str) -> str:
    """Normalizes synonym embedding types ('title' -> 'headline', 'content' -> 'body')."""
    lower = emb_type.strip().lower()
    if lower in ("title", "headline"):
        return "headline"
    if lower in ("content", "body", "summary"):
        return "body"
    return lower


@dataclass(frozen=True)
class GeneratedVector:
    """
    Container representing a generated embedding vector.

    Attributes:
        vector: List of floating point coordinates.
        dimensions: Vector length.
        model_name: Name of the model used to generate this vector.
        provider: Provider name ('mock', 'openai', 'gemini').
    """

    vector: List[float]
    dimensions: int
    model_name: str
    provider: str


# =============================================================================
# Abstract Embedding Provider Interface
# =============================================================================

class BaseEmbeddingProvider(ABC):
    """Abstract base class for all embedding providers."""

    @abstractmethod
    def embed_text(self, text: str) -> GeneratedVector:
        """Generates a dense vector for a single input text string."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[GeneratedVector]:
        """Generates dense vectors for a batch of text strings."""
        pass

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Returns the dimensionality of the generated vectors."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns the model identifier."""
        pass


# =============================================================================
# Mock Deterministic Provider (Default for Offline / Testing)
# =============================================================================

class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic pseudo-embedding provider for testing and offline development.
    Produces repeatable normalized vectors based on input text hashes without network access.
    """

    def __init__(self, model_name: str = "mock-text-embedding-v1", dimensions: int = 1536):
        self._model_name = model_name
        self._dimensions = dimensions

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_text(self, text: str) -> GeneratedVector:
        """Generates a unit-normalized deterministic vector from the SHA-256 hash of the text."""
        if not text:
            vector = [0.0] * self._dimensions
            return GeneratedVector(
                vector=vector,
                dimensions=self._dimensions,
                model_name=self._model_name,
                provider="mock",
            )

        # Seed coordinates deterministically from SHA-256 hex digest
        base_seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
        raw_values = []
        for i in range(self._dimensions):
            val = math.sin((base_seed + i) * 0.1)
            raw_values.append(val)

        # L2-normalize vector to unit length
        norm = math.sqrt(sum(x * x for x in raw_values))
        if norm > 0:
            normalized_vec = [round(x / norm, 6) for x in raw_values]
        else:
            normalized_vec = raw_values

        return GeneratedVector(
            vector=normalized_vec,
            dimensions=self._dimensions,
            model_name=self._model_name,
            provider="mock",
        )

    def embed_batch(self, texts: List[str]) -> List[GeneratedVector]:
        return [self.embed_text(t) for t in texts]


# =============================================================================
# OpenAI Embedding Provider
# =============================================================================

class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """Embedding provider connecting to OpenAI's Embeddings API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "text-embedding-3-small",
        dimensions: int = 1536,
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 15.0,
    ):
        self._api_key = api_key or settings.EMBEDDING_API_KEY
        self._model_name = model_name
        self._dimensions = dimensions
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        if not self._api_key:
            logger.warning("OpenAIEmbeddingProvider initialized without an EMBEDDING_API_KEY.")

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_text(self, text: str) -> GeneratedVector:
        vectors = self.embed_batch([text])
        if not vectors:
            raise RuntimeError("OpenAI Embeddings API returned no vectors.")
        return vectors[0]

    def embed_batch(self, texts: List[str]) -> List[GeneratedVector]:
        if not self._api_key:
            raise ValueError("OpenAI API key is missing. Set EMBEDDING_API_KEY in environment or .env.")

        cleaned_inputs = [t.strip() for t in texts]
        if not any(cleaned_inputs):
            return [
                GeneratedVector(
                    vector=[0.0] * self._dimensions,
                    dimensions=self._dimensions,
                    model_name=self._model_name,
                    provider="openai",
                )
                for _ in texts
            ]

        url = f"{self._base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model_name,
            "input": cleaned_inputs,
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"OpenAI API error {exc.response.status_code}: {exc.response.text}") from exc
        except httpx.RequestError as exc:
            raise ConnectionError(f"Network request to OpenAI failed: {exc}") from exc

        items = data.get("data", [])
        # Ensure ordered matching
        items.sort(key=lambda x: x.get("index", 0))

        results = []
        for item in items:
            vec = item.get("embedding", [])
            results.append(
                GeneratedVector(
                    vector=vec,
                    dimensions=len(vec) or self._dimensions,
                    model_name=self._model_name,
                    provider="openai",
                )
            )
        return results


# =============================================================================
# Google Gemini Embedding Provider
# =============================================================================

class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Embedding provider connecting to Google Gemini's text-embedding API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "text-embedding-004",
        dimensions: int = 768,
        timeout: float = 15.0,
    ):
        self._api_key = api_key or settings.EMBEDDING_API_KEY
        self._model_name = model_name
        self._dimensions = dimensions
        self._timeout = timeout

        if not self._api_key:
            logger.warning("GeminiEmbeddingProvider initialized without an EMBEDDING_API_KEY.")

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_text(self, text: str) -> GeneratedVector:
        if not self._api_key:
            raise ValueError("Gemini API key is missing. Set EMBEDDING_API_KEY in environment or .env.")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._model_name}:embedContent?key={self._api_key}"
        )
        payload = {
            "model": f"models/{self._model_name}",
            "content": {"parts": [{"text": text}]},
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Gemini API error {exc.response.status_code}: {exc.response.text}") from exc
        except httpx.RequestError as exc:
            raise ConnectionError(f"Network request to Gemini failed: {exc}") from exc

        embedding_data = data.get("embedding", {})
        values = embedding_data.get("values", [])
        return GeneratedVector(
            vector=values,
            dimensions=len(values) or self._dimensions,
            model_name=self._model_name,
            provider="gemini",
        )

    def embed_batch(self, texts: List[str]) -> List[GeneratedVector]:
        return [self.embed_text(t) for t in texts]


# =============================================================================
# Provider Factory
# =============================================================================

def get_embedding_provider(
    provider_name: Optional[str] = None,
    model_name: Optional[str] = None,
    dimensions: Optional[int] = None,
    api_key: Optional[str] = None,
) -> BaseEmbeddingProvider:
    """
    Factory function resolving the active embedding provider based on parameters
    or application settings.
    """
    selected_provider = (provider_name or settings.EMBEDDING_PROVIDER).strip().lower()
    selected_model = model_name or settings.EMBEDDING_MODEL_NAME
    selected_dims = dimensions or settings.EMBEDDING_DIMENSIONS

    if selected_provider == "openai":
        return OpenAIEmbeddingProvider(
            api_key=api_key,
            model_name=selected_model,
            dimensions=selected_dims,
        )
    elif selected_provider == "gemini":
        return GeminiEmbeddingProvider(
            api_key=api_key,
            model_name=selected_model,
            dimensions=selected_dims,
        )
    elif selected_provider == "mock":
        return MockEmbeddingProvider(
            model_name=selected_model,
            dimensions=selected_dims,
        )
    else:
        logger.warning(
            "Unknown EMBEDDING_PROVIDER '%s'. Falling back to 'mock' deterministic provider.",
            selected_provider,
        )
        return MockEmbeddingProvider(
            model_name=selected_model,
            dimensions=selected_dims,
        )


# =============================================================================
# Core Article Embedding Orchestration Service
# =============================================================================

def generate_article_embedding(
    db: Session,
    article: Article,
    embedding_type: str = "headline",
    provider: Optional[BaseEmbeddingProvider] = None,
    force_regenerate: bool = False,
) -> Tuple[ArticleEmbeddingResultDetail, Optional[GeneratedVector]]:
    """
    Generates and persists an embedding record for a single article.

    Flow:
    1. Preprocesses article text using the reusable preprocessing pipeline.
    2. Validates whether text is available for the requested target ('headline' or 'body').
       - If headline is missing/untitled -> skips safely.
       - If body is missing/empty -> skips safely.
    3. Checks whether a valid embedding already exists in PostgreSQL for this article,
       embedding type, and model. If so and force_regenerate is False, skips duplicate generation.
    4. Generates the vector via the active provider.
    5. Saves or updates the ArticleEmbedding record in PostgreSQL with vector reference ID,
       model name, dimensions, and creation timestamp.
    6. Leaves the original Article content and attributes completely intact.

    Returns:
        Tuple of (ArticleEmbeddingResultDetail, Optional[GeneratedVector])
    """
    norm_type = normalize_embedding_type(embedding_type)
    active_provider = provider or get_embedding_provider()
    model_name = active_provider.model_name

    # 1. Preprocess article text (non-destructive)
    processed: ProcessedArticleText = preprocess_article(article)

    # 2. Extract target text and check availability
    text_to_embed = ""
    if norm_type == "headline":
        if not processed.headline or processed.headline == "Untitled Article":
            logger.info("Skipping article ID %d: Headline text is empty or untitled.", article.id)
            return (
                ArticleEmbeddingResultDetail(
                    article_id=article.id,
                    embedding_type=norm_type,
                    status="skipped",
                    model_name=model_name,
                    error="Headline text is missing or untitled",
                ),
                None,
            )
        text_to_embed = processed.headline

    elif norm_type == "body":
        if not processed.is_body_available or not processed.body.strip():
            logger.info("Skipping article ID %d: Body content is unavailable.", article.id)
            return (
                ArticleEmbeddingResultDetail(
                    article_id=article.id,
                    embedding_type=norm_type,
                    status="skipped",
                    model_name=model_name,
                    error="Body text is missing or empty",
                ),
                None,
            )
        text_to_embed = processed.body

    else:
        return (
            ArticleEmbeddingResultDetail(
                article_id=article.id,
                embedding_type=norm_type,
                status="error",
                model_name=model_name,
                error=f"Unsupported embedding type '{embedding_type}'. Choose 'headline' or 'body'.",
            ),
            None,
        )

    # 3. Check for existing embedding (duplicate prevention)
    existing_emb = (
        db.query(ArticleEmbedding)
        .filter(
            ArticleEmbedding.article_id == article.id,
            ArticleEmbedding.embedding_type == norm_type,
            ArticleEmbedding.model_name == model_name,
        )
        .first()
    )

    if existing_emb and not force_regenerate:
        logger.info(
            "Skipping article ID %d: Embedding already exists for type='%s' and model='%s'",
            article.id,
            norm_type,
            model_name,
        )
        return (
            ArticleEmbeddingResultDetail(
                article_id=article.id,
                embedding_type=norm_type,
                status="skipped",
                model_name=model_name,
                vector_reference=existing_emb.vector_reference,
                dimensions=existing_emb.dimensions,
                error="Embedding already exists (use force_regenerate=True to update)",
            ),
            None,
        )

    # 4. Generate Vector via active provider
    try:
        gen_vector = active_provider.embed_text(text_to_embed)
    except Exception as exc:
        logger.error("Failed to generate embedding for article ID %d: %s", article.id, exc)
        return (
            ArticleEmbeddingResultDetail(
                article_id=article.id,
                embedding_type=norm_type,
                status="error",
                model_name=model_name,
                error=str(exc),
            ),
            None,
        )

    # 5. Prepare vector reference identifier for vector database
    point_uuid = f"art-{article.id}-{norm_type}-{uuid.uuid4().hex[:12]}"

    # 6. Persist metadata in PostgreSQL
    if existing_emb:
        existing_emb.vector_reference = point_uuid
        existing_emb.dimensions = gen_vector.dimensions
        db.flush()
    else:
        new_emb = ArticleEmbedding(
            article_id=article.id,
            embedding_type=norm_type,
            model_name=model_name,
            vector_reference=point_uuid,
            dimensions=gen_vector.dimensions,
        )
        db.add(new_emb)
        db.flush()

    db.commit()

    return (
        ArticleEmbeddingResultDetail(
            article_id=article.id,
            embedding_type=norm_type,
            status="generated",
            model_name=model_name,
            vector_reference=point_uuid,
            dimensions=gen_vector.dimensions,
            error=None,
        ),
        gen_vector,
    )


def run_article_embedding_generation(
    db: Session,
    article_ids: Optional[List[int]] = None,
    embedding_type: str = "headline",
    force_regenerate: bool = False,
    limit: Optional[int] = None,
    provider: Optional[BaseEmbeddingProvider] = None,
) -> EmbeddingGenerateSummaryResponse:
    """
    Batch runner for article embedding generation across the database.

    Args:
        db: Database session.
        article_ids: Optional specific article IDs to process. If None, processes eligible articles.
        embedding_type: 'headline', 'body', or 'all' (processes both sequentially).
        force_regenerate: Whether to overwrite existing embeddings for the model.
        limit: Max articles to evaluate.
        provider: Custom or mocked embedding provider. Defaults to configured provider.
    """
    active_provider = provider or get_embedding_provider()
    model_name = active_provider.model_name

    # Resolve query
    query = db.query(Article)
    if article_ids:
        query = query.filter(Article.id.in_(article_ids))

    query = query.order_by(Article.id.asc())
    if limit is not None and limit > 0:
        query = query.limit(limit)

    articles = query.all()

    # Determine types to generate
    types_to_process = []
    norm_req = embedding_type.strip().lower()
    if norm_req in ("all", "both"):
        types_to_process = ["headline", "body"]
    else:
        types_to_process = [normalize_embedding_type(norm_req)]

    details: List[ArticleEmbeddingResultDetail] = []
    generated_count = 0
    skipped_count = 0
    error_count = 0

    for article in articles:
        for emb_type in types_to_process:
            detail, _ = generate_article_embedding(
                db=db,
                article=article,
                embedding_type=emb_type,
                provider=active_provider,
                force_regenerate=force_regenerate,
            )
            details.append(detail)
            if detail.status == "generated":
                generated_count += 1
            elif detail.status == "skipped":
                skipped_count += 1
            else:
                error_count += 1

    return EmbeddingGenerateSummaryResponse(
        status="completed",
        embedding_type=embedding_type,
        model_name=model_name,
        articles_considered=len(articles),
        embeddings_generated=generated_count,
        articles_skipped=skipped_count,
        errors_encountered=error_count,
        details=details,
    )
