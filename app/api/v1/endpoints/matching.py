"""
Article Matching and Classification Endpoints.

Provides endpoints to:
1. Trigger candidate retrieval and classification into SAME / RELATED / DIFFERENT:
   `POST /api/articles/{article_id}/match`
2. Retrieve all matches for an article:
   `GET /api/articles/{article_id}/matches`
3. Retrieve a specific match by ID:
   `GET /api/matches/{match_id}`
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.article_match import (
    ArticleMatchRequest,
    ArticleMatchResponse,
    ArticleMatchSummaryResponse,
    MatchLabelType,
)
from app.services.matching import get_matching_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/articles/{article_id}/match",
    response_model=ArticleMatchSummaryResponse,
    summary="Match and classify candidate articles for an article",
    description=(
        "Retrieves nearest-neighbor candidates via the vector database, extracts multi-signal evidence "
        "(headline similarity, body similarity, entity overlap, publication recency, event alignment), "
        "and classifies candidate pairs into SAME, RELATED, or DIFFERENT. Stores results in PostgreSQL."
    ),
)
def match_article_candidates(
    article_id: int,
    request: ArticleMatchRequest = ArticleMatchRequest(),
    db: Session = Depends(get_db),
):
    """
    Triggers pairwise article matching and classification for an article.
    """
    service = get_matching_service()
    try:
        return service.match_article_with_candidates(
            db=db,
            article_id=article_id,
            candidate_limit=request.candidate_limit,
            score_threshold=request.score_threshold,
            force_reclassify=request.force_reclassify,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.error("Error matching candidates for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pairwise matching failed: {exc}",
        )


@router.get(
    "/articles/{article_id}/matches",
    response_model=List[ArticleMatchResponse],
    summary="Get all matches for an article",
    description="Returns all stored pairwise match records involving the specified article.",
)
def get_article_matches(
    article_id: int,
    label: Optional[str] = Query(None, description="Filter by classification label: SAME, RELATED, or DIFFERENT"),
    limit: int = Query(50, ge=1, le=100, description="Max matches to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
):
    """
    Retrieve stored article matches for a given article.
    """
    service = get_matching_service()
    try:
        return service.get_matches_for_article(
            db=db,
            article_id=article_id,
            label=label,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error retrieving matches for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve matches: {exc}",
        )


@router.get(
    "/matches/{match_id}",
    response_model=ArticleMatchResponse,
    summary="Get an article match by ID",
    description="Returns the details of a specific article match record.",
)
def get_match_by_id(
    match_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieve a single match by its primary key.
    """
    service = get_matching_service()
    result = service.get_match_by_id(db=db, match_id=match_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article match with ID {match_id} does not exist.",
        )
    return result
