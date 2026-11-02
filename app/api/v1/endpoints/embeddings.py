"""
Article Embeddings API Endpoints.

Provides endpoints to trigger embedding generation for collected news articles,
inspect embedding metadata, and prepare vector references for downstream vector indexing.
Vectors are kept out of standard HTTP response payloads for optimal network efficiency.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.article_embedding import ArticleEmbedding
from app.schemas.embedding import (
    EmbeddingGenerateRequest,
    EmbeddingGenerateSummaryResponse,
    ArticleEmbeddingResultDetail,
)
from app.services.embedding import (
    run_article_embedding_generation,
    normalize_embedding_type,
)

router = APIRouter()


@router.post(
    "/generate",
    response_model=EmbeddingGenerateSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger article embedding generation",
    description=(
        "Generates dense vector embeddings for news article headlines or body content. "
        "Applies text preprocessing, checks for existing embeddings to prevent duplicates, "
        "records vector reference metadata in PostgreSQL, and reports summary statistics."
    ),
)
def generate_embeddings(
    request: EmbeddingGenerateRequest = EmbeddingGenerateRequest(),
    db: Session = Depends(get_db),
) -> EmbeddingGenerateSummaryResponse:
    """
    Trigger embedding generation for eligible articles.
    """
    norm_type = request.embedding_type.strip().lower()
    if norm_type not in ("headline", "body", "title", "content", "all", "both"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid embedding_type '{request.embedding_type}'. Must be 'headline', 'body', or 'all'.",
        )

    summary = run_article_embedding_generation(
        db=db,
        article_ids=request.article_ids,
        embedding_type=request.embedding_type,
        force_regenerate=request.force_regenerate,
        limit=request.limit,
    )
    return summary


@router.get(
    "/article/{article_id}",
    response_model=List[ArticleEmbeddingResultDetail],
    summary="Get embeddings for a specific article",
    description="Returns metadata for all embeddings generated for a given article.",
)
def get_article_embeddings(
    article_id: int,
    db: Session = Depends(get_db),
) -> List[ArticleEmbeddingResultDetail]:
    """
    Lists generated embedding records for an article.
    """
    embeddings = (
        db.query(ArticleEmbedding)
        .filter(ArticleEmbedding.article_id == article_id)
        .order_by(ArticleEmbedding.created_at.desc())
        .all()
    )

    return [
        ArticleEmbeddingResultDetail(
            article_id=emb.article_id,
            embedding_type=emb.embedding_type,
            status="generated",
            model_name=emb.model_name,
            vector_reference=emb.vector_reference,
            dimensions=emb.dimensions,
            error=None,
        )
        for emb in embeddings
    ]

