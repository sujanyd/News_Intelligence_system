"""
Similarity Search Endpoints.

Provides endpoints to discover semantically similar news articles using Qdrant vector search
and PostgreSQL metadata.
Does not expose raw dense vector arrays in response payloads.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.similarity import (
    ArticleSimilarityResponse,
    get_similarity_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/article/{article_id}",
    response_model=ArticleSimilarityResponse,
    summary="Find similar articles by article ID",
    description=(
        "Retrieves the embedding vector for the specified article and searches for top similar articles "
        "in the vector database, strictly excluding the query article itself."
    ),
)
def find_similar_articles_by_id(
    article_id: int,
    embedding_type: str = Query("headline", description="Target type: 'headline' or 'body'"),
    limit: int = Query(10, ge=1, le=50, description="Maximum similar articles to retrieve"),
    score_threshold: Optional[float] = Query(None, ge=-1.0, le=1.0, description="Minimum cosine similarity score"),
    db: Session = Depends(get_db),
):
    """
    Finds top similar articles using nearest neighbor vector similarity in Qdrant.
    """
    service = get_similarity_service()
    try:
        return service.find_similar_by_article_id(
            db=db,
            article_id=article_id,
            embedding_type=embedding_type,
            limit=limit,
            score_threshold=score_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.error("Error during similarity search for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Similarity search failed: {exc}",
        )

