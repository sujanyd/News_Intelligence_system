"""
Tone and Framing Analysis API Endpoints.

Provides endpoints to:
1. Trigger or retrieve full tone and framing analysis for an article.
2. Retrieve overall article tone, continuous valence score, and confidence.
3. Retrieve headline framing analysis (primary frame, detected frames, evidence phrases).
4. Retrieve article-level framing signals with supporting evidence text and character offsets.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.article import Article
from app.schemas.tone_framing import (
    AnalyzeToneFramingRequest,
    ArticleToneResponse,
    FramingSignalResponse,
    HeadlineFramingResponse,
    ToneAndFramingAnalysisResponse,
)
from app.services.tone_framing import get_tone_framing_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{article_id}/tone-framing",
    response_model=ToneAndFramingAnalysisResponse,
    summary="Get tone and framing analysis",
    description="Retrieves the overall tone, headline framing, and all identified framing signals for an article.",
)
def get_tone_and_framing(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_tone_framing_service()
    try:
        return service.analyze_and_store_tone_and_framing(
            db=db,
            article_id=article_id,
            force_reanalyze=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve tone and framing for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tone and framing analysis failed: {exc}",
        )


@router.post(
    "/{article_id}/tone-framing/analyze",
    response_model=ToneAndFramingAnalysisResponse,
    summary="Trigger tone and framing analysis",
    description="Executes tone classification and framing signal extraction, updating ARTICLE_ANALYSIS and storing signals in ANALYSIS_FRAMING_SIGNAL.",
)
def analyze_tone_and_framing(
    article_id: int,
    payload: Optional[AnalyzeToneFramingRequest] = None,
    db: Session = Depends(get_db),
):
    service = get_tone_framing_service()
    force_reanalyze = payload.force_reanalyze if payload else False
    try:
        return service.analyze_and_store_tone_and_framing(
            db=db,
            article_id=article_id,
            force_reanalyze=force_reanalyze,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to execute tone and framing analysis for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tone and framing execution failed: {exc}",
        )


@router.get(
    "/{article_id}/tone",
    response_model=ArticleToneResponse,
    summary="Get article tone",
    description="Returns the overall tone category, valence score (-1.0 to +1.0), and confidence for the article.",
)
def get_article_tone_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_tone_framing_service()
    try:
        return service.get_article_tone(db=db, article_id=article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve tone for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tone: {exc}",
        )


@router.get(
    "/{article_id}/headline-framing",
    response_model=HeadlineFramingResponse,
    summary="Get headline framing",
    description="Returns headline framing analysis including detected frames, primary frame, and evidence phrases.",
)
def get_article_headline_framing_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_tone_framing_service()
    try:
        return service.get_article_headline_framing(db=db, article_id=article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve headline framing for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve headline framing: {exc}",
        )


@router.get(
    "/{article_id}/framing-signals",
    response_model=List[FramingSignalResponse],
    summary="Get article framing signals",
    description="Returns all extracted framing signals with verbatim evidence text, character offsets, and explanations.",
)
def get_article_framing_signals_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_tone_framing_service()
    try:
        signals = service.get_article_framing_signals(db=db, article_id=article_id)
        return [FramingSignalResponse.model_validate(s) for s in signals]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve framing signals for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve framing signals: {exc}",
        )
