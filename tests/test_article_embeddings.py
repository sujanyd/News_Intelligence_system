"""
Tests for Article Embedding Service and Endpoints.

Validates:
1. Valid headline embedding generation from preprocessed titles.
2. Missing title handling (safely skips without generating meaningless embeddings).
3. Missing body content handling (safely skips body embeddings while allowing headline embeddings).
4. Duplicate embedding prevention (skips regeneration if embedding already exists for model/type).
5. Regeneration support (force_regenerate=True updates existing embeddings).
6. Embedding provider failure handling (records error status without crashing the pipeline).
7. Correct article association and PostgreSQL metadata persistence (ArticleEmbedding model).
8. Support for both HEADLINE and BODY embedding types (and 'all').
9. Configurable embedding provider resolution (Mock, OpenAI, Gemini).
10. API endpoint triggers (POST /api/embeddings/generate and GET /api/embeddings/article/{id}).
"""

from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.models.news_source import NewsSource
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


@pytest.fixture
def sample_source(db_session: Session) -> NewsSource:
    """Fixture providing a news source."""
    source = NewsSource(name="Global Financial Wire", base_url="https://gfw.org")
    db_session.add(source)
    db_session.commit()
    return source


@pytest.fixture
def sample_article(db_session: Session, sample_source: NewsSource) -> Article:
    """Fixture providing an article with full text."""
    article = Article(
        source_id=sample_source.id,
        title="  <b>Federal Reserve Holds</b> Rates Steady at 5.25%  ",
        content=(
            "<p>WASHINGTON - The Federal Reserve concluded its policy meeting today, "
            "maintaining benchmark interest rates in response to moderated inflation indicators.</p>\n\n"
            "<p>Chair Jerome Powell emphasized continued vigilance regarding labor markets.</p>"
        ),
        url="https://gfw.org/economy/fed-rates-nov-2026",
        canonical_url="https://gfw.org/economy/fed-rates-nov-2026",
        content_availability="full_text",
    )
    db_session.add(article)
    db_session.commit()
    return article


class TestEmbeddingProviderBasics:
    """Unit tests for embedding providers and factory resolution."""

    def test_mock_provider_deterministic_unit_vectors(self):
        """Mock provider generates repeatable unit-normalized vectors."""
        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        assert provider.dimensions == 128
        assert provider.model_name == "mock-model"

        vec1 = provider.embed_text("Federal Reserve holds rates")
        vec2 = provider.embed_text("Federal Reserve holds rates")
        vec_diff = provider.embed_text("Completely different story about astronomy")

        assert len(vec1.vector) == 128
        assert vec1.dimensions == 128
        assert vec1.vector == vec2.vector
        assert vec1.vector != vec_diff.vector
        assert vec1.provider == "mock"

    def test_mock_provider_empty_string(self):
        """Mock provider handles empty text safely."""
        provider = MockEmbeddingProvider(dimensions=64)
        vec = provider.embed_text("")
        assert vec.vector == [0.0] * 64

    def test_provider_factory_resolution(self):
        """Factory instantiates appropriate provider based on name or defaults."""
        mock_prov = get_embedding_provider("mock", model_name="custom-mock", dimensions=256)
        assert isinstance(mock_prov, MockEmbeddingProvider)
        assert mock_prov.dimensions == 256
        assert mock_prov.model_name == "custom-mock"

        openai_prov = get_embedding_provider("openai", api_key="sk-test-key", model_name="text-embedding-3-small")
        assert isinstance(openai_prov, OpenAIEmbeddingProvider)

        gemini_prov = get_embedding_provider("gemini", api_key="gm-test-key", model_name="text-embedding-004")
        assert isinstance(gemini_prov, GeminiEmbeddingProvider)

    def test_normalize_embedding_type(self):
        """Standardizes synonym types."""
        assert normalize_embedding_type("headline") == "headline"
        assert normalize_embedding_type("title") == "headline"
        assert normalize_embedding_type("body") == "body"
        assert normalize_embedding_type("content") == "body"
        assert normalize_embedding_type("summary") == "body"


class TestArticleEmbeddingGenerationService:
    """Tests for generate_article_embedding and run_article_embedding_generation."""

    def test_valid_headline_embedding_generation(self, db_session: Session, sample_article: Article):
        """Generates headline embedding from cleaned title and stores metadata in PostgreSQL."""
        provider = MockEmbeddingProvider(model_name="test-model", dimensions=128)

        detail, vector = generate_article_embedding(
            db=db_session,
            article=sample_article,
            embedding_type="headline",
            provider=provider,
        )

        assert detail.status == "generated"
        assert detail.article_id == sample_article.id
        assert detail.embedding_type == "headline"
        assert detail.model_name == "test-model"
        assert detail.dimensions == 128
        assert detail.vector_reference is not None
        assert detail.error is None
        assert vector is not None
        assert len(vector.vector) == 128

        # Verify record in database
        emb = (
            db_session.query(ArticleEmbedding)
            .filter_by(article_id=sample_article.id, embedding_type="headline")
            .first()
        )
        assert emb is not None
        assert emb.model_name == "test-model"
        assert emb.dimensions == 128
        assert emb.vector_reference == detail.vector_reference
        assert emb.article.id == sample_article.id

        # CRITICAL: Original Article data must remain unchanged
        assert "<b>" in sample_article.title
        assert sample_article.content_availability == "full_text"

    def test_valid_body_embedding_generation(self, db_session: Session, sample_article: Article):
        """Generates separate body embedding for article content."""
        provider = MockEmbeddingProvider(model_name="test-model", dimensions=128)

        detail, vector = generate_article_embedding(
            db=db_session,
            article=sample_article,
            embedding_type="body",
            provider=provider,
        )

        assert detail.status == "generated"
        assert detail.embedding_type == "body"
        assert vector is not None

        # Verify both headline and body can coexist for the same article
        generate_article_embedding(db_session, sample_article, "headline", provider=provider)
        count = db_session.query(ArticleEmbedding).filter_by(article_id=sample_article.id).count()
        assert count == 2

    def test_missing_title_skips_headline_embedding(self, db_session: Session, sample_source: NewsSource):
        """Articles without a valid title are safely skipped without generating embeddings."""
        article = Article(
            source_id=sample_source.id,
            title="   ",
            content="Valid body content.",
            url="https://gfw.org/article/no-title",
            content_availability="summary_only",
        )
        db_session.add(article)
        db_session.commit()

        detail, vector = generate_article_embedding(
            db=db_session,
            article=article,
            embedding_type="headline",
        )

        assert detail.status == "skipped"
        assert "missing or untitled" in detail.error.lower()
        assert vector is None

        # Ensure no embedding was inserted
        emb = db_session.query(ArticleEmbedding).filter_by(article_id=article.id).first()
        assert emb is None

    def test_missing_body_skips_body_embedding_safely(self, db_session: Session, sample_source: NewsSource):
        """Headline-only articles skip body embedding safely while allowing headline embedding."""
        article = Article(
            source_id=sample_source.id,
            title="Breaking News Flash",
            content=None,
            url="https://gfw.org/article/headline-only",
            content_availability="headline_only",
        )
        db_session.add(article)
        db_session.commit()

        # Headline embedding succeeds
        detail_head, vec_head = generate_article_embedding(db_session, article, "headline")
        assert detail_head.status == "generated"
        assert vec_head is not None

        # Body embedding skipped safely
        detail_body, vec_body = generate_article_embedding(db_session, article, "body")
        assert detail_body.status == "skipped"
        assert "body text is missing or empty" in detail_body.error.lower()
        assert vec_body is None

    def test_duplicate_embedding_prevention(self, db_session: Session, sample_article: Article):
        """Repeated generation runs skip already-embedded articles unless force_regenerate is True."""
        provider = MockEmbeddingProvider(model_name="test-model", dimensions=64)

        # 1. First run generates embedding
        d1, _ = generate_article_embedding(db_session, sample_article, "headline", provider=provider)
        assert d1.status == "generated"

        # 2. Second run detects existing embedding and skips
        d2, _ = generate_article_embedding(
            db_session, sample_article, "headline", provider=provider, force_regenerate=False
        )
        assert d2.status == "skipped"
        assert "already exists" in d2.error.lower()

        # Verify only 1 embedding row exists in database
        embs = (
            db_session.query(ArticleEmbedding)
            .filter_by(article_id=sample_article.id, embedding_type="headline")
            .all()
        )
        assert len(embs) == 1

        # 3. Third run with force_regenerate=True updates existing record
        d3, _ = generate_article_embedding(
            db_session, sample_article, "headline", provider=provider, force_regenerate=True
        )
        assert d3.status == "generated"
        embs_after = (
            db_session.query(ArticleEmbedding)
            .filter_by(article_id=sample_article.id, embedding_type="headline")
            .all()
        )
        assert len(embs_after) == 1

    def test_provider_failure_handled_gracefully(self, db_session: Session, sample_article: Article):
        """Provider network or API errors record error status without breaking pipeline execution."""
        failing_provider = MagicMock(spec=BaseEmbeddingProvider)
        failing_provider.model_name = "failing-api-model"
        failing_provider.dimensions = 1536
        failing_provider.embed_text.side_effect = ConnectionError("OpenAI API endpoint unreachable")

        detail, vector = generate_article_embedding(
            db=db_session,
            article=sample_article,
            embedding_type="headline",
            provider=failing_provider,
        )

        assert detail.status == "error"
        assert "OpenAI API endpoint unreachable" in detail.error
        assert vector is None

        # Check that no invalid row was saved
        count = db_session.query(ArticleEmbedding).filter_by(article_id=sample_article.id).count()
        assert count == 0

    def test_run_batch_embedding_generation_all_types(self, db_session: Session, sample_article: Article):
        """Batch generation runner processes 'all' (headline and body) for multiple articles."""
        provider = MockEmbeddingProvider(model_name="batch-model", dimensions=64)

        summary = run_article_embedding_generation(
            db=db_session,
            article_ids=[sample_article.id],
            embedding_type="all",
            provider=provider,
        )

        assert summary.status == "completed"
        assert summary.articles_considered == 1
        assert summary.embeddings_generated == 2  # 1 headline + 1 body
        assert summary.articles_skipped == 0
        assert summary.errors_encountered == 0
        assert len(summary.details) == 2


class TestEmbeddingAPIEndpoints:
    """Integration tests for the /api/embeddings and /api/v1/embeddings endpoints."""

    def test_api_generate_embeddings_endpoint_success(self, client, sample_article: Article):
        """POST /api/embeddings/generate triggers embedding generation and returns summary."""
        payload = {
            "article_ids": [sample_article.id],
            "embedding_type": "headline",
            "force_regenerate": True,
        }

        response = client.post("/api/embeddings/generate", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "completed"
        assert data["embedding_type"] == "headline"
        assert data["articles_considered"] == 1
        assert data["embeddings_generated"] == 1
        assert data["articles_skipped"] == 0
        assert data["errors_encountered"] == 0
        assert len(data["details"]) == 1
        assert data["details"][0]["article_id"] == sample_article.id
        assert data["details"][0]["status"] == "generated"

        # Verify high-dimensional raw float vectors are NOT in normal HTTP responses
        assert "vector" not in data["details"][0]

    def test_api_generate_embeddings_invalid_type(self, client):
        """POST /api/embeddings/generate returns 400 for invalid embedding types."""
        payload = {
            "embedding_type": "invalid_type_xyz",
        }
        response = client.post("/api/embeddings/generate", json=payload)
        assert response.status_code == 400
        assert "Invalid embedding_type" in response.json()["detail"]

    def test_api_get_article_embeddings(self, client, sample_article: Article, db_session: Session):
        """GET /api/embeddings/article/{id} returns metadata for generated embeddings."""
        # Generate embedding directly
        generate_article_embedding(db_session, sample_article, "headline")

        response = client.get(f"/api/embeddings/article/{sample_article.id}")
        assert response.status_code == 200

        items = response.json()
        assert len(items) >= 1
        assert items[0]["article_id"] == sample_article.id
        assert items[0]["embedding_type"] == "headline"
        assert items[0]["vector_reference"] is not None

    def test_api_v1_and_api_prefix_parity(self, client, sample_article: Article):
        """Both /api/embeddings and /api/v1/embeddings are accessible."""
        res1 = client.get(f"/api/embeddings/article/{sample_article.id}")
        res2 = client.get(f"/api/v1/embeddings/article/{sample_article.id}")
        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json() == res2.json()

