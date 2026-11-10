"""
AI-Generated News Text Detection API Endpoints.

Provides endpoints to:
1. Retrieve AI-generated text likelihood estimate for an article (/articles/{id}/ai-detection).
2. Trigger or force re-analysis of an article's AI likelihood (/articles/{id}/ai-detection/analyze).
3. List articles flagged for human editorial review (/articles/ai-detection/flagged).
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ai_detection import (
    AIDetectionResponse,
    AnalyzeAIDetectionRequest,
)
from app.services.ai_detection import get_ai_detection_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/ai-detection/flagged",
    response_model=List[AIDetectionResponse],
    summary="List articles flagged for review",
    description="Retrieves articles where AI-generated likelihood exceeds the review threshold.",
)
def list_flagged_articles_endpoint(
    limit: int = Query(50, ge=1, le=100, description="Max flagged articles to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    db: Session = Depends(get_db),
):
    service = get_ai_detection_service()
    return service.list_flagged_articles(db=db, limit=limit, offset=offset)


@router.get(
    "/{article_id}/ai-detection",
    response_model=AIDetectionResponse,
    summary="Get AI detection estimate",
    description="Retrieves the statistical likelihood estimation that an article was machine-generated.",
)
def get_article_ai_detection_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_ai_detection_service()
    try:
        return service.get_article_ai_detection(db=db, article_id=article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve AI detection for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI detection retrieval failed: {exc}",
        )


@router.post(
    "/{article_id}/ai-detection/analyze",
    response_model=AIDetectionResponse,
    summary="Analyze article AI likelihood",
    description="Evaluates or re-evaluates an article for machine-generated text characteristics and records the result.",
)
def analyze_article_ai_detection_endpoint(
    article_id: int,
    request: AnalyzeAIDetectionRequest = AnalyzeAIDetectionRequest(),
    db: Session = Depends(get_db),
):
    service = get_ai_detection_service()
    try:
        return service.analyze_and_store_article(
            db=db,
            article_id=article_id,
            force_reanalyze=request.force_reanalyze,
            flag_threshold=request.flag_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to analyze AI detection for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI detection analysis failed: {exc}",
        )

