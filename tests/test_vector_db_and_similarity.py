"""
Tests for Vector Database Integration and Similarity Search Service.

Verifies:
1. Vector database connection & health check.
2. Collection creation and verification.
3. Storing article embedding vectors with metadata payloads.
4. Retrieving vectors by similarity using Cosine metric.
5. Excluding the original query article itself from results.
6. Saving vector references in PostgreSQL ArticleEmbedding records.
7. Graceful error handling and fault tolerance when vector database fails.
8. Safe deletion and replacement of vectors on regeneration.
9. End-to-end integration across Article -> Preprocessing -> Embedding -> Qdrant -> Similarity Search.
"""

from unittest.mock import MagicMock, patch
import pytest
from qdrant_client import QdrantClient
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.models.news_source import NewsSource
from app.services.embedding import (
    MockEmbeddingProvider,
    generate_article_embedding,
    run_article_embedding_generation,
)
from app.services.similarity import (
    ArticleSimilarityMatch,
    ArticleSimilarityResponse,
    SimilaritySearchService,
    get_similarity_service,
)
from app.services.vector_db import (
    VectorDatabaseService,
    VectorSearchResult,
    get_vector_db_service,
    set_vector_db_service,
)


@pytest.fixture
def sample_news_source(db_session: Session) -> NewsSource:
    source = NewsSource(
        name="Global News Network",
        base_url="https://globalnews.org",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def populated_articles(db_session: Session, sample_news_source: NewsSource) -> list[Article]:
    """Creates a diverse set of sample articles for similarity testing."""
    articles_data = [
        (
            "Federal Reserve Cuts Interest Rates by 25 Basis Points",
            "The Federal Reserve lowered benchmark interest rates today in an effort to sustain economic momentum.",
            "https://globalnews.org/articles/fed-rate-cut-1",
        ),
        (
            "Central Bank Reduces Policy Rate Amid Cooling Inflation",
            "In a widely anticipated move, monetary policymakers cut interest rates as inflationary pressures subside.",
            "https://globalnews.org/articles/fed-rate-cut-2",
        ),
        (
            "Stock Markets Rally Following Central Bank Monetary Easing",
            "Major stock indices soared following the central bank's decision to ease monetary policy and lower borrowing costs.",
            "https://globalnews.org/articles/markets-rally-fed",
        ),
        (
            "Mars Rover Uncovers Evidence of Ancient Microbial Habitat",
            "NASA robotic explorer identified complex organic compounds and sedimentary rock formations on the Martian surface.",
            "https://globalnews.org/articles/mars-rover-discovery",
        ),
    ]

    created = []
    for title, content, url in articles_data:
        art = Article(
            source_id=sample_news_source.id,
            title=title,
            content=content,
            url=url,
            content_availability="full_text",
        )
        db_session.add(art)
        created.append(art)

    db_session.commit()
    for art in created:
        db_session.refresh(art)
    return created


class TestVectorDatabaseService:
    """Unit tests for the VectorDatabaseService core functionality."""

    def test_vector_db_connection_and_health_check(self):
        """Verifies vector database connects and reports healthy."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, dimensions=128)
        assert vdb.is_healthy() is True

    def test_ensure_collection_creates_and_verifies_collection(self):
        """Creates collection if missing, and verifies idempotency if called again."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, collection_name="test_col", dimensions=64)

        assert vdb.ensure_collection("test_col", dimensions=64) is True
        # Second call should recognize existing collection
        assert vdb.ensure_collection("test_col", dimensions=64) is True

        collections = [c.name for c in client.get_collections().collections]
        assert "test_col" in collections

    def test_store_and_retrieve_vector_by_id(self):
        """Stores a vector with payload and retrieves it by point ID."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, dimensions=4)

        dummy_vector = [0.25, 0.5, 0.75, 1.0]
        point_id = vdb.store_vector(
            vector_id="art-10-headline-test",
            vector=dummy_vector,
            article_id=10,
            embedding_type="headline",
            model_name="test-model",
            extra_payload={"title": "Test Title"},
        )

        assert point_id is not None
        retrieved = vdb.get_vector_by_id("art-10-headline-test")
        assert retrieved is not None
        assert retrieved["payload"]["article_id"] == 10
        assert retrieved["payload"]["embedding_type"] == "headline"
        assert retrieved["payload"]["title"] == "Test Title"

    def test_search_similar_returns_top_matches(self):
        """Searches similar vectors using Cosine similarity metric."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, dimensions=3)

        # Vector A: [1, 0, 0]
        # Vector B: [0.99, 0.05, 0] (very close to A)
        # Vector C: [0, 1, 0] (orthogonal to A)
        vdb.store_vector("art-1-head", [1.0, 0.0, 0.0], article_id=1, embedding_type="headline", model_name="m1")
        vdb.store_vector("art-2-head", [0.99, 0.05, 0.0], article_id=2, embedding_type="headline", model_name="m1")
        vdb.store_vector("art-3-head", [0.0, 1.0, 0.0], article_id=3, embedding_type="headline", model_name="m1")

        results = vdb.search_similar(
            query_vector=[1.0, 0.0, 0.0],
            limit=2,
            exclude_article_id=None,
        )

        assert len(results) == 2
        # Highest match is article 1 (~1.0), then article 2 (~0.99)
        assert results[0].article_id == 1
        assert results[0].similarity_score > 0.99
        assert results[1].article_id == 2

    def test_search_similar_excludes_original_article(self):
        """Self-exclusion rule: query article itself is filtered out from results."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, dimensions=3)

        vdb.store_vector("art-1-head", [1.0, 0.0, 0.0], article_id=1, embedding_type="headline", model_name="m1")
        vdb.store_vector("art-2-head", [0.95, 0.1, 0.0], article_id=2, embedding_type="headline", model_name="m1")

        # Exclude article 1
        results = vdb.search_similar(
            query_vector=[1.0, 0.0, 0.0],
            limit=5,
            exclude_article_id=1,
        )

        assert len(results) == 1
        assert results[0].article_id == 2
        assert all(r.article_id != 1 for r in results)

    def test_delete_vector_and_delete_by_article_id(self):
        """Safely removes vector points by ID or article_id."""
        client = QdrantClient(":memory:")
        vdb = VectorDatabaseService(client=client, dimensions=3)

        vdb.store_vector("art-5-head", [1.0, 0.0, 0.0], article_id=5, embedding_type="headline", model_name="m1")
        assert vdb.get_vector_by_id("art-5-head") is not None

        # Delete by vector point
        deleted = vdb.delete_vector("art-5-head")
        assert deleted is True
        assert vdb.get_vector_by_id("art-5-head") is None

        # Re-store and delete by article_id
        vdb.store_vector("art-6-head", [0.0, 1.0, 0.0], article_id=6, embedding_type="headline", model_name="m1")
        vdb.delete_by_article_id(article_id=6)
        assert vdb.get_vector_by_id("art-6-head") is None


class TestEmbeddingAndVectorDBIntegration:
    """Tests end-to-end embedding generation with Qdrant vector storage."""

    def test_generate_embedding_stores_in_qdrant_and_postgres(
        self,
        db_session: Session,
        sample_news_source: NewsSource,
    ):
        """Embedding generation stores vector in Qdrant and saves vector_reference in PostgreSQL."""
        article = Article(
            source_id=sample_news_source.id,
            title="Global Climate Summit Agrees on New Carbon Transition Accord",
            content="Delegates from over 190 nations reached agreement on emissions milestones.",
            url="https://globalnews.org/articles/climate-summit-2026",
            content_availability="full_text",
        )
        db_session.add(article)
        db_session.commit()
        db_session.refresh(article)

        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        detail, gen_vec = generate_article_embedding(
            db=db_session,
            article=article,
            embedding_type="headline",
            provider=provider,
        )

        assert detail.status == "generated"
        assert detail.vector_reference is not None
        assert detail.dimensions == 128

        # Verify PostgreSQL record
        pg_record = (
            db_session.query(ArticleEmbedding)
            .filter(ArticleEmbedding.article_id == article.id)
            .first()
        )
        assert pg_record is not None
        assert pg_record.vector_reference == detail.vector_reference
        assert pg_record.embedding_type == "headline"
        assert pg_record.model_name == "mock-model"

        # Verify Qdrant record
        vdb = get_vector_db_service()
        qdrant_record = vdb.get_vector_by_id(detail.vector_reference)
        assert qdrant_record is not None
        assert qdrant_record["payload"]["article_id"] == article.id
        assert qdrant_record["payload"]["embedding_type"] == "headline"
        assert len(qdrant_record["vector"]) == 128

    def test_vector_db_failure_recovers_gracefully(
        self,
        db_session: Session,
        sample_news_source: NewsSource,
    ):
        """When vector database upsert fails, service reports error and rolls back without corrupting database."""
        article = Article(
            source_id=sample_news_source.id,
            title="Technological Breakthrough in Solid State Batteries",
            content="Researchers developed high energy density cells with rapid charging capabilities.",
            url="https://globalnews.org/articles/solid-state-battery-tech",
            content_availability="full_text",
        )
        db_session.add(article)
        db_session.commit()

        # Mock vector DB to raise error
        failing_vdb = MagicMock(spec=VectorDatabaseService)
        failing_vdb.store_vector.side_effect = RuntimeError("Qdrant connection dropped")

        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        detail, vec = generate_article_embedding(
            db=db_session,
            article=article,
            embedding_type="headline",
            provider=provider,
            vector_db=failing_vdb,
        )

        assert detail.status == "error"
        assert "Vector database storage error" in detail.error

        # Ensure no orphan record was committed in PostgreSQL
        orphan = (
            db_session.query(ArticleEmbedding)
            .filter(ArticleEmbedding.article_id == article.id)
            .first()
        )
        assert orphan is None


class TestSimilaritySearchService:
    """Tests semantic similarity queries using SimilaritySearchService."""

    def test_find_similar_by_article_id_success(
        self,
        db_session: Session,
        populated_articles: list[Article],
    ):
        """Finds nearest neighbor articles given an article ID, excluding itself."""
        # Generate embeddings for all sample articles
        provider = MockEmbeddingProvider(model_name="mock-similarity-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in populated_articles],
            embedding_type="headline",
            provider=provider,
        )

        sim_service = get_similarity_service()
        target_article = populated_articles[0]  # "Federal Reserve Cuts Interest Rates"

        response: ArticleSimilarityResponse = sim_service.find_similar_by_article_id(
            db=db_session,
            article_id=target_article.id,
            embedding_type="headline",
            limit=5,
        )

        assert response.query_article_id == target_article.id
        assert response.query_title == target_article.title
        assert response.embedding_type == "headline"
        assert len(response.matches) > 0

        # Verify the target article itself is strictly excluded
        matched_ids = [m.article_id for m in response.matches]
        assert target_article.id not in matched_ids

        # Verify matches contain required metadata
        first_match: ArticleSimilarityMatch = response.matches[0]
        assert first_match.article_id != target_article.id
        assert first_match.title is not None
        assert first_match.source_name == "Global News Network"
        assert -1.0 <= first_match.similarity_score <= 1.0

    def test_find_similar_by_text_query(
        self,
        db_session: Session,
        populated_articles: list[Article],
    ):
        """Finds similar articles by arbitrary text query."""
        provider = MockEmbeddingProvider(model_name="mock-similarity-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in populated_articles],
            embedding_type="headline",
            provider=provider,
        )

        sim_service = get_similarity_service()
        response = sim_service.find_similar_by_text(
            db=db_session,
            query_text="Central bank interest rate cuts",
            embedding_type="headline",
            provider=provider,
            limit=3,
        )

        assert response.total_matches > 0
        assert len(response.matches) <= 3
        for match in response.matches:
            assert -1.0 <= match.similarity_score <= 1.0
            assert match.vector_id is not None

    def test_find_similar_raises_error_for_nonexistent_article(self, db_session: Session):
        """Raises ValueError if article does not exist."""
        sim_service = get_similarity_service()
        with pytest.raises(ValueError, match="does not exist"):
            sim_service.find_similar_by_article_id(
                db=db_session,
                article_id=999999,
            )

    def test_find_similar_raises_error_if_embedding_missing(
        self,
        db_session: Session,
        sample_news_source: NewsSource,
    ):
        """Raises ValueError if article has no generated embeddings."""
        article = Article(
            source_id=sample_news_source.id,
            title="Unembedded Article",
            content="Sample text",
            url="https://globalnews.org/unembedded",
            content_availability="full_text",
        )
        db_session.add(article)
        db_session.commit()

        sim_service = get_similarity_service()
        with pytest.raises(ValueError, match="No 'headline' embedding found"):
            sim_service.find_similar_by_article_id(
                db=db_session,
                article_id=article.id,
                embedding_type="headline",
            )


class TestSimilarityAPIEndpoints:
    """Tests FastAPI endpoints for similarity search."""

    def test_api_find_similar_by_article_id(
        self,
        client,
        db_session: Session,
        populated_articles: list[Article],
    ):
        """GET /api/similarity/article/{id} returns ranked similar articles."""
        provider = MockEmbeddingProvider(model_name="mock-api-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in populated_articles],
            embedding_type="headline",
            provider=provider,
        )

        target = populated_articles[0]
        response = client.get(f"/api/similarity/article/{target.id}?limit=3")
        assert response.status_code == 200

        data = response.json()
        assert data["query_article_id"] == target.id
        assert data["query_title"] == target.title
        assert data["embedding_type"] == "headline"
        assert len(data["matches"]) > 0

        # Self exclusion
        for match in data["matches"]:
            assert match["article_id"] != target.id
            assert "vector" not in match  # Raw vectors must not be exposed

    def test_api_find_similar_not_found(self, client):
        """Returns 404 when querying an invalid article ID."""
        response = client.get("/api/similarity/article/999999")
        assert response.status_code == 404

    def test_api_v1_and_api_prefix_parity(
        self,
        client,
        db_session: Session,
        populated_articles: list[Article],
    ):
        """Ensures /api/similarity/... and /api/v1/similarity/... route identically."""
        provider = MockEmbeddingProvider(model_name="mock-api-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[populated_articles[0].id],
            embedding_type="headline",
            provider=provider,
        )
        target = populated_articles[0]

        res_v1 = client.get(f"/api/v1/similarity/article/{target.id}")
        res_plain = client.get(f"/api/similarity/article/{target.id}")

        assert res_v1.status_code == 200
        assert res_plain.status_code == 200
        assert res_v1.json() == res_plain.json()
