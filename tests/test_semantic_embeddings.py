"""
Semantic Embedding & Persistent Vector Search Verification Test Suite.

Verifies:
1. Local SentenceTransformersProvider generates real semantic embeddings (all-MiniLM-L6-v2).
2. Similar sentences have significantly higher similarity than unrelated sentences.
3. Different wording about the same event retrieves relevant candidate articles.
4. Unrelated articles rank significantly lower.
5. Embedding dimensions match the configured model (384 for all-MiniLM-L6-v2).
6. Vectors are normalized to unit length.
7. Qdrant insertion and retrieval work correctly.
8. Persistent vectors survive re-initializing client from the same storage directory.
9. Mock provider is only active when explicitly selected for tests; unknown providers reject silent fallback.
"""

import math
import shutil
import tempfile
import pytest

from app.services.embedding import (
    SentenceTransformersProvider,
    MockEmbeddingProvider,
    get_embedding_provider,
)
from app.services.vector_db import VectorDatabaseService


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))


class TestSemanticEmbeddingProvider:
    """Verifies SentenceTransformersProvider semantic fidelity and normalization."""

    @pytest.fixture(scope="class")
    def provider(self):
        return SentenceTransformersProvider(model_name="all-MiniLM-L6-v2")

    def test_embedding_dimensions_and_metadata(self, provider):
        """Embedding dimensions must match actual model output (384)."""
        vec = provider.embed_text("Clean energy agreement reached at COP conference.")
        assert vec.dimensions == 384
        assert len(vec.vector) == 384
        assert vec.provider == "sentence-transformers"
        assert vec.model_name == "all-MiniLM-L6-v2"

    def test_vector_normalization(self, provider):
        """Vectors must be unit normalized (magnitude == 1.0)."""
        vec = provider.embed_text("Sample headline for unit norm check.")
        magnitude = math.sqrt(sum(x * x for x in vec.vector))
        assert pytest.approx(magnitude, rel=1e-3) == 1.0

    def test_semantic_similarity_vs_unrelated(self, provider):
        """Similar sentences must have high similarity; unrelated sentences must rank much lower."""
        # Related solar news
        s1 = "Prime Minister inaugurates new solar energy plant in Gujarat"
        s2 = "PM Modi unveils major renewable solar power project in Gujarat"
        # Unrelated flood news
        s3 = "Severe flood warnings issued for coastal districts of Odisha"

        v1 = provider.embed_text(s1).vector
        v2 = provider.embed_text(s2).vector
        v3 = provider.embed_text(s3).vector

        sim_related = cosine(v1, v2)
        sim_unrelated = cosine(v1, v3)

        assert sim_related > 0.75, f"Expected high semantic similarity, got {sim_related}"
        assert sim_unrelated < 0.35, f"Expected low similarity for unrelated text, got {sim_unrelated}"
        assert (sim_related - sim_unrelated) > 0.45

    def test_different_wording_same_event(self, provider):
        """Different journalistic wording of the same event must show higher semantic alignment than unrelated news."""
        h1 = "Federal Reserve cuts benchmark interest rate by 25 basis points"
        h2 = "US central bank lowers borrowing costs as inflation cools down"
        h3 = "Tech stocks rally as quarterly earnings beat Wall Street estimates"

        v1 = provider.embed_text(h1).vector
        v2 = provider.embed_text(h2).vector
        v3 = provider.embed_text(h3).vector

        sim_fed = cosine(v1, v2)
        sim_tech = cosine(v1, v3)

        # Monetary policy event pair has ~2x the similarity of unrelated tech earnings
        assert sim_fed > 0.40
        assert sim_fed > (sim_tech + 0.15)

    def test_empty_string_handled_safely(self, provider):
        """Empty string returns zero vector without crashing."""
        vec = provider.embed_text("")
        assert vec.dimensions == 384
        assert all(x == 0.0 for x in vec.vector)

    def test_batch_embedding(self, provider):
        """Batch embedding returns consistent vectors matching individual encoding."""
        texts = [
            "Global equity markets rebound after inflation report",
            "Oil prices dip on supply concerns",
        ]
        batch_vecs = provider.embed_batch(texts)
        assert len(batch_vecs) == 2
        for bv in batch_vecs:
            assert bv.dimensions == 384
            norm = math.sqrt(sum(x * x for x in bv.vector))
            assert pytest.approx(norm, rel=1e-3) == 1.0


class TestEmbeddingProviderConfiguration:
    """Verifies provider resolution and prohibition of silent mock fallbacks."""

    def test_explicit_mock_provider_resolution(self):
        """Mock provider works when explicitly configured for test runs."""
        prov = get_embedding_provider(provider_name="mock", dimensions=128)
        assert isinstance(prov, MockEmbeddingProvider)
        assert prov.dimensions == 128

    def test_sentence_transformers_provider_resolution(self):
        """Sentence-transformers resolves to SentenceTransformersProvider."""
        prov = get_embedding_provider(provider_name="sentence-transformers")
        assert isinstance(prov, SentenceTransformersProvider)
        assert prov.dimensions == 384

    def test_unknown_provider_raises_error_no_silent_fallback(self):
        """Unknown provider must raise ValueError rather than silently returning mock."""
        with pytest.raises(ValueError) as exc_info:
            get_embedding_provider(provider_name="unknown-magic-provider")
        assert "Unsupported or unconfigured EMBEDDING_PROVIDER" in str(exc_info.value)
        assert "Silent fallback to mock embeddings is prohibited" in str(exc_info.value)


class TestQdrantPersistenceAndLifecycle:
    """Verifies Qdrant persistent storage, vector retrieval, and restart survival."""

    @pytest.fixture
    def temp_qdrant_dir(self):
        tmp_dir = tempfile.mkdtemp(prefix="test_qdrant_persist_")
        yield tmp_dir
        shutil.rmtree(tmp_dir, ignore_errors=True)

    def test_vector_storage_and_retrieval(self, temp_qdrant_dir):
        """Vectors can be upserted and retrieved by similarity search."""
        from qdrant_client import QdrantClient

        client = QdrantClient(path=temp_qdrant_dir)
        vdb = VectorDatabaseService(
            client=client,
            collection_name="test_articles",
            dimensions=384,
        )
        provider = SentenceTransformersProvider(model_name="all-MiniLM-L6-v2")

        # Ingest 2 sample articles
        v1 = provider.embed_text("Federal Reserve reduces interest rates").vector
        v2 = provider.embed_text("ISRO launches lunar exploration craft").vector

        vdb.store_vector(
            vector_id="art-101-headline",
            vector=v1,
            article_id=101,
            embedding_type="headline",
            model_name="all-MiniLM-L6-v2",
            extra_payload={"title": "Federal Reserve Cuts Rates"},
        )
        vdb.store_vector(
            vector_id="art-102-headline",
            vector=v2,
            article_id=102,
            embedding_type="headline",
            model_name="all-MiniLM-L6-v2",
            extra_payload={"title": "ISRO Moon Mission"},
        )

        # Query for central banking
        query_vec = provider.embed_text("US monetary policy and central bank rate cuts").vector
        matches = vdb.search_similar(query_vector=query_vec, limit=2)

        assert len(matches) == 2
        top_match = matches[0]
        assert top_match.article_id == 101
        assert top_match.similarity_score > 0.60
        assert top_match.similarity_score > matches[1].similarity_score

    def test_persistent_vectors_survive_client_restart(self, temp_qdrant_dir):
        """Vectors stored in local path must remain available after closing and reopening client."""
        from qdrant_client import QdrantClient

        provider = SentenceTransformersProvider(model_name="all-MiniLM-L6-v2")
        vec = provider.embed_text("Renewable energy summit concludes").vector

        # Phase 1: Write vector and close
        client_1 = QdrantClient(path=temp_qdrant_dir)
        vdb_1 = VectorDatabaseService(
            client=client_1,
            collection_name="test_restart",
            dimensions=384,
        )
        vdb_1.store_vector(
            vector_id="persist-pt-1",
            vector=vec,
            article_id=555,
            embedding_type="headline",
            model_name="all-MiniLM-L6-v2",
            extra_payload={"title": "Summit Concludes"},
        )
        client_1.close()

        # Phase 2: Open brand-new client on same path (simulating application restart)
        client_2 = QdrantClient(path=temp_qdrant_dir)
        vdb_2 = VectorDatabaseService(
            client=client_2,
            collection_name="test_restart",
            dimensions=384,
        )

        query_vec = provider.embed_text("Clean energy conference").vector
        results = vdb_2.search_similar(query_vector=query_vec, limit=1)

        assert len(results) == 1
        assert results[0].article_id == 555
        assert results[0].similarity_score > 0.50
        assert results[0].payload.get("title") == "Summit Concludes"
        client_2.close()

    def test_dimension_mismatch_collection_recreation(self, temp_qdrant_dir):
        """Incompatible dimensions must recreate the collection cleanly rather than corrupting vector space."""
        from qdrant_client import QdrantClient

        client = QdrantClient(path=temp_qdrant_dir)
        # Create with dim 128
        vdb_old = VectorDatabaseService(client=client, collection_name="test_dims", dimensions=128)
        vdb_old.ensure_collection()

        # Re-initialize service with requested dim 384
        vdb_new = VectorDatabaseService(client=client, collection_name="test_dims", dimensions=384)
        vdb_new.ensure_collection()

        info = client.get_collection("test_dims")
        size = info.config.params.vectors.size
        assert size == 384
        client.close()
