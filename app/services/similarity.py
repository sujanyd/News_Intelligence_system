"""
Similarity Search Service Module.

Provides semantic similarity search across articles using Qdrant vector database
and PostgreSQL metadata.

Key capabilities:
1. find_similar_articles_by_id:
   Accepts an article ID and finds the top similar articles by retrieving its
   stored embedding vector from Qdrant, searching for nearest neighbors,
   excluding the query article itself, and returning similarity scores with metadata.
2. find_similar_articles_by_vector:
   Accepts an arbitrary query embedding vector, finds top similar articles,
   and excludes a specified article ID if provided.
3. find_similar_articles_by_text:
   Accepts arbitrary raw text (such as a headline or query statement),
   generates its embedding vector using the configured embedding provider,
   and searches for the most similar articles in the vector database.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.models.news_source import NewsSource
from app.services.embedding import get_embedding_provider, normalize_embedding_type
from app.services.vector_db import (
    VectorDatabaseService,
    VectorSearchResult,
    get_vector_db_service,
)

logger = logging.getLogger(__name__)


class ArticleSimilarityMatch(BaseModel):
    """
    Structured similarity match response for API and internal services.
    Does NOT expose raw embedding float arrays.
    """
    article_id: int = Field(..., description="PostgreSQL ID of the matched article")
    title: Optional[str] = Field(None, description="Title of the matched article")
    source_name: Optional[str] = Field(None, description="Name of the news source/publisher")
    source_id: Optional[int] = Field(None, description="ID of the news source")
    url: Optional[str] = Field(None, description="Canonical or primary URL of the article")
    published_at: Optional[str] = Field(None, description="Publication timestamp ISO string")
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    embedding_type: str = Field(..., description="Target type evaluated ('headline' or 'body')")
    model_name: str = Field(..., description="Embedding model used for comparison")
    vector_id: str = Field(..., description="Point ID reference in Qdrant")


class ArticleSimilarityResponse(BaseModel):
    """
    Response schema summarizing similarity search results.
    """
    query_article_id: Optional[int] = Field(None, description="Query article ID if searched by ID")
    query_title: Optional[str] = Field(None, description="Title of the query article")
    embedding_type: str = Field(..., description="Embedding type searched ('headline' or 'body')")
    model_name: str = Field(..., description="Embedding model used")
    total_matches: int = Field(..., description="Total matches found satisfying criteria")
    matches: List[ArticleSimilarityMatch] = Field(
        default_factory=list,
        description="Ranked list of similar articles (excluding query article)",
    )


class SimilaritySearchService:
    """
    Orchestration service combining vector database search with PostgreSQL relational data.
    """

    def __init__(self, vector_db: Optional[VectorDatabaseService] = None):
        self._vector_db = vector_db

    @property
    def vector_db(self) -> VectorDatabaseService:
        if self._vector_db is None:
            return get_vector_db_service()
        return self._vector_db

    def find_similar_by_article_id(
        self,
        db: Session,
        article_id: int,
        embedding_type: str = "headline",
        limit: int = 10,
        score_threshold: Optional[float] = None,
        model_name: Optional[str] = None,
    ) -> ArticleSimilarityResponse:
        """
        Finds the top similar articles for a given article ID in PostgreSQL.

        1. Verifies the query article exists in PostgreSQL.
        2. Retrieves the article's embedding record from PostgreSQL.
        3. Retrieves the query vector from Qdrant by point ID.
        4. Searches Qdrant for nearest neighbors, excluding the query article itself.
        5. Enriches vector matches with article metadata from PostgreSQL.
        """
        norm_type = normalize_embedding_type(embedding_type)

        # 1. Fetch query article
        query_article = db.query(Article).filter(Article.id == article_id).first()
        if not query_article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # 2. Fetch ArticleEmbedding record
        query_emb_filter = [
            ArticleEmbedding.article_id == article_id,
            ArticleEmbedding.embedding_type == norm_type,
        ]
        if model_name:
            query_emb_filter.append(ArticleEmbedding.model_name == model_name)

        query_emb = (
            db.query(ArticleEmbedding)
            .filter(*query_emb_filter)
            .order_by(ArticleEmbedding.created_at.desc())
            .first()
        )

        if not query_emb:
            raise ValueError(
                f"No '{norm_type}' embedding found for article ID {article_id}. "
                f"Please generate embeddings first via POST /api/embeddings/generate."
            )

        active_model = query_emb.model_name
        vector_ref = query_emb.vector_reference

        # 3. Retrieve query vector from Qdrant
        vector_data = self.vector_db.get_vector_by_id(vector_ref)
        if not vector_data or not vector_data.get("vector"):
            raise RuntimeError(
                f"Vector for reference '{vector_ref}' could not be retrieved from Qdrant. "
                "The vector index may need regeneration."
            )

        query_vector = vector_data["vector"]

        # 4. Search similar vectors excluding article itself
        raw_matches = self.vector_db.search_similar(
            query_vector=query_vector,
            limit=limit,
            exclude_article_id=article_id,
            embedding_type=norm_type,
            model_name=active_model,
            score_threshold=score_threshold,
        )

        # 5. Enrich matches with relational data
        enriched_matches = self._enrich_matches(db, raw_matches)

        return ArticleSimilarityResponse(
            query_article_id=article_id,
            query_title=query_article.title,
            embedding_type=norm_type,
            model_name=active_model,
            total_matches=len(enriched_matches),
            matches=enriched_matches,
        )

    def find_similar_by_vector(
        self,
        db: Session,
        query_vector: List[float],
        embedding_type: str = "headline",
        limit: int = 10,
        exclude_article_id: Optional[int] = None,
        model_name: Optional[str] = None,
        score_threshold: Optional[float] = None,
    ) -> ArticleSimilarityResponse:
        """
        Finds similar articles given an arbitrary input vector.
        """
        norm_type = normalize_embedding_type(embedding_type)

        raw_matches = self.vector_db.search_similar(
            query_vector=query_vector,
            limit=limit,
            exclude_article_id=exclude_article_id,
            embedding_type=norm_type,
            model_name=model_name,
            score_threshold=score_threshold,
        )

        enriched_matches = self._enrich_matches(db, raw_matches)

        return ArticleSimilarityResponse(
            query_article_id=exclude_article_id,
            query_title=None,
            embedding_type=norm_type,
            model_name=model_name or "custom-vector",
            total_matches=len(enriched_matches),
            matches=enriched_matches,
        )

    def find_similar_by_text(
        self,
        db: Session,
        query_text: str,
        embedding_type: str = "headline",
        limit: int = 10,
        exclude_article_id: Optional[int] = None,
        provider: Optional[Any] = None,
        score_threshold: Optional[float] = None,
    ) -> ArticleSimilarityResponse:
        """
        Generates an embedding for input text and searches for similar articles.
        """
        if not query_text or not query_text.strip():
            raise ValueError("Query text cannot be empty.")

        norm_type = normalize_embedding_type(embedding_type)
        active_provider = provider or get_embedding_provider()
        gen_vector = active_provider.embed_text(query_text.strip())

        return self.find_similar_by_vector(
            db=db,
            query_vector=gen_vector.vector,
            embedding_type=norm_type,
            limit=limit,
            exclude_article_id=exclude_article_id,
            model_name=active_provider.model_name,
            score_threshold=score_threshold,
        )

    def _enrich_matches(
        self,
        db: Session,
        raw_matches: List[VectorSearchResult],
    ) -> List[ArticleSimilarityMatch]:
        """
        Fetches article and news source details from PostgreSQL for each vector match.
        """
        if not raw_matches:
            return []

        article_ids = [m.article_id for m in raw_matches]
        articles = (
            db.query(Article)
            .join(NewsSource, Article.source_id == NewsSource.id, isouter=True)
            .filter(Article.id.in_(article_ids))
            .all()
        )
        article_map = {a.id: a for a in articles}

        enriched: List[ArticleSimilarityMatch] = []
        for match in raw_matches:
            art = article_map.get(match.article_id)
            title = art.title if art else None
            source_name = art.source.name if art and art.source else None
            source_id = art.source_id if art else None
            url = art.canonical_url or (art.url if art else None)
            pub_date = art.published_at.isoformat() if art and art.published_at else None

            enriched.append(
                ArticleSimilarityMatch(
                    article_id=match.article_id,
                    title=title,
                    source_name=source_name,
                    source_id=source_id,
                    url=url,
                    published_at=pub_date,
                    similarity_score=round(match.similarity_score, 4),
                    embedding_type=match.embedding_type,
                    model_name=match.model_name,
                    vector_id=match.vector_id,
                )
            )

        return enriched


# Global similarity search service provider
_similarity_service: Optional[SimilaritySearchService] = None


def get_similarity_service() -> SimilaritySearchService:
    global _similarity_service
    if _similarity_service is None:
        _similarity_service = SimilaritySearchService()
    return _similarity_service
