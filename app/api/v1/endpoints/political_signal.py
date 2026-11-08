"""
Political and Party-Leaning Signal Analysis API Endpoints.

Provides endpoints to:
1. Retrieve political entities mentioned in an article (/articles/{article_id}/political-entities).
2. Retrieve political signals and ideological slant estimates for an article (/articles/{article_id}/political-signals).
3. Trigger/re-analyze political signals for an article (/articles/{article_id}/political-signals/analyze).
4. Retrieve comparative political signals across news outlets for a comparison session (/comparisons/{comparison_id}/political-signals).
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.article import Article
from app.schemas.political_signal import (
    AnalyzePoliticalSignalsRequest,
    ArticlePoliticalSignalResponse,
    ComparisonPoliticalCoverageResponse,
    ComparisonPoliticalSignalResponse,
    PoliticalEntityResponse,
    PoliticalPresentationSignal,
)
from app.services.political_signal import get_political_signal_service

logger = logging.getLogger(__name__)

# Router for article-scoped endpoints (prefix: /articles)
article_router = APIRouter()

# Router for comparison-scoped endpoints (prefix: /comparisons)
comparison_router = APIRouter()


# ---------------------------------------------------------------------------
# Article-Level Political Signal Endpoints
# ---------------------------------------------------------------------------

@article_router.get(
    "/{article_id}/political-signals",
    response_model=ArticlePoliticalSignalResponse,
    summary="Get article political signals",
    description="Retrieves recognized political entities, presentation signals, ideological slant, and partisanship metrics for an article.",
)
def get_article_political_signals_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_political_signal_service()
    try:
        return service.analyze_and_store_article_political_signals(
            db=db,
            article_id=article_id,
            force_reanalyze=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve political signals for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Political signal analysis failed: {exc}",
        )


@article_router.post(
    "/{article_id}/political-signals/analyze",
    response_model=ArticlePoliticalSignalResponse,
    summary="Analyze article political signals",
    description="Evaluates or forces re-evaluation of political leaning signals, updating database records and optionally linking to a comparison.",
)
def analyze_article_political_signals_endpoint(
    article_id: int,
    request: AnalyzePoliticalSignalsRequest = AnalyzePoliticalSignalsRequest(),
    db: Session = Depends(get_db),
):
    service = get_political_signal_service()
    try:
        return service.analyze_and_store_article_political_signals(
            db=db,
            article_id=article_id,
            force_reanalyze=request.force_reanalyze,
            comparison_id=request.comparison_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to run political signal analysis for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Political signal analysis failed: {exc}",
        )


@article_router.get(
    "/{article_id}/political-entities",
    response_model=List[PoliticalEntityResponse],
    summary="Get political entities in article",
    description="Returns recognized political parties, politicians, and political organizations mentioned in an article.",
)
def get_article_political_entities_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_political_signal_service()
    try:
        res = service.analyze_and_store_article_political_signals(
            db=db,
            article_id=article_id,
            force_reanalyze=False,
        )
        return res.political_entities
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve political entities for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Political entity retrieval failed: {exc}",
        )


@article_router.get(
    "/{article_id}/political-evidence",
    response_model=List[PoliticalPresentationSignal],
    summary="Get political presentation evidence",
    description="Returns all extracted sentences and clauses serving as evidence for political entity presentation.",
)
def get_article_political_evidence_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_political_signal_service()
    try:
        res = service.analyze_and_store_article_political_signals(
            db=db,
            article_id=article_id,
            force_reanalyze=False,
        )
        return res.signals
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve political evidence for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Political evidence retrieval failed: {exc}",
        )


# ---------------------------------------------------------------------------
# Comparison-Level Political Signal Endpoints
# ---------------------------------------------------------------------------

@comparison_router.get(
    "/{comparison_id}/political-signals",
    response_model=ComparisonPoliticalCoverageResponse,
    summary="Get comparative political coverage signals",
    description="Retrieves cross-publisher political leaning signals, ideological slant comparisons, and diversity summary for a NewsComparison session.",
)
def get_comparison_political_signals_endpoint(
    comparison_id: int,
    db: Session = Depends(get_db),
):
    service = get_political_signal_service()
    try:
        return service.get_comparison_political_coverage(
            db=db,
            comparison_id=comparison_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve comparison political signals for comparison %d: %s", comparison_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison political signals retrieval failed: {exc}",
        )
