"""
News Comparisons and Reports API Endpoints.

Provides endpoints to:
1. Initiate cross-source comparisons (/comparisons).
2. List comparison sessions (/comparisons).
3. Retrieve detailed comparison session with articles, coverage, evidences, and political signals (/comparisons/{id}).
4. Retrieve comparative evidence items (/comparisons/{id}/evidence).
5. Retrieve comparative coverage evaluations (/comparisons/{id}/coverage).
6. Generate synthesized evidence-based reports (/reports/generate).
7. List reports (/reports).
8. Retrieve single report (/reports/{id}).
9. Detect exact and near-duplicates for an article (/articles/{id}/detect-duplicates).
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.comparison_report import (
    ComparisonCoverageResponse,
    ComparisonEvidenceResponse,
    DuplicateCheckResponse,
    NewsComparisonCreate,
    NewsComparisonDetailResponse,
    NewsComparisonSummaryResponse,
    ReportCreateRequest,
    ReportResponse,
)
from app.services.comparison import get_comparison_service
from app.services.duplicate_detection import get_duplicate_detection_service
from app.services.report import get_report_service

logger = logging.getLogger(__name__)

# Router for /comparisons
comparison_router = APIRouter()

# Router for /reports
report_router = APIRouter()

# Router for duplicate detection under /articles
duplicate_router = APIRouter()


# ---------------------------------------------------------------------------
# Duplicate Detection Endpoint
# ---------------------------------------------------------------------------

@duplicate_router.post(
    "/{article_id}/detect-duplicates",
    response_model=DuplicateCheckResponse,
    summary="Detect exact or near-duplicates",
    description="Evaluates whether an article is an exact or near-duplicate of an existing article, updating duplicate_of_article_id.",
)
def detect_article_duplicates_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_duplicate_detection_service()
    try:
        return service.detect_and_link_duplicates_for_article(db=db, article_id=article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to detect duplicates for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Duplicate detection failed: {exc}",
        )


# ---------------------------------------------------------------------------
# News Comparison Endpoints
# ---------------------------------------------------------------------------

@comparison_router.post(
    "",
    response_model=NewsComparisonDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create news comparison",
    description="Initiates a cross-publisher comparison across multiple articles or all articles mapped to an event.",
)
def create_comparison_endpoint(
    comparison_in: NewsComparisonCreate,
    db: Session = Depends(get_db),
):
    service = get_comparison_service()
    try:
        return service.create_or_run_comparison(
            db=db,
            title=comparison_in.title,
            description=comparison_in.description,
            event_id=comparison_in.event_id,
            article_ids=comparison_in.article_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to create comparison: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"News comparison failed: {exc}",
        )


@comparison_router.get(
    "",
    response_model=List[NewsComparisonSummaryResponse],
    summary="List news comparisons",
    description="Retrieves comparison sessions ordered by recency.",
)
def list_comparisons_endpoint(
    limit: int = Query(50, ge=1, le=100, description="Max comparisons to return"),
    offset: int = Query(0, ge=0, description="Number of comparisons to skip"),
    db: Session = Depends(get_db),
):
    service = get_comparison_service()
    return service.list_comparisons(db=db, limit=limit, offset=offset)


@comparison_router.get(
    "/{comparison_id}",
    response_model=NewsComparisonDetailResponse,
    summary="Get comparison details",
    description="Retrieves a complete news comparison session including compared articles, coverage depth, contrastive evidence, and political signals.",
)
def get_comparison_endpoint(
    comparison_id: int,
    db: Session = Depends(get_db),
):
    service = get_comparison_service()
    try:
        return service.get_comparison_detail(db=db, comparison_id=comparison_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to get comparison %d: %s", comparison_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison retrieval failed: {exc}",
        )


@comparison_router.get(
    "/{comparison_id}/evidence",
    response_model=List[ComparisonEvidenceResponse],
    summary="Get comparison evidence items",
    description="Retrieves granular evidence items (framing contrasts, omissions, tone discrepancies) discovered during comparison.",
)
def get_comparison_evidence_endpoint(
    comparison_id: int,
    db: Session = Depends(get_db),
):
    service = get_comparison_service()
    try:
        detail = service.get_comparison_detail(db=db, comparison_id=comparison_id)
        return detail.evidences
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@comparison_router.get(
    "/{comparison_id}/coverage",
    response_model=List[ComparisonCoverageResponse],
    summary="Get comparison coverage depth",
    description="Retrieves per-article coverage evaluation (depth score, tone, dominant frame, omissions) within a comparison session.",
)
def get_comparison_coverage_endpoint(
    comparison_id: int,
    db: Session = Depends(get_db),
):
    service = get_comparison_service()
    try:
        detail = service.get_comparison_detail(db=db, comparison_id=comparison_id)
        return detail.coverages
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# Report Endpoints
# ---------------------------------------------------------------------------

@report_router.post(
    "/generate",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate evidence-based report",
    description="Synthesizes an analytical intelligence report from a completed news comparison session.",
)
def generate_report_endpoint(
    report_in: ReportCreateRequest,
    db: Session = Depends(get_db),
):
    service = get_report_service()
    try:
        return service.generate_comparison_report(
            db=db,
            comparison_id=report_in.comparison_id,
            title=report_in.title,
            report_format=report_in.report_format,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to generate report for comparison %d: %s", report_in.comparison_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {exc}",
        )


@report_router.get(
    "",
    response_model=List[ReportResponse],
    summary="List intelligence reports",
    description="Retrieves synthesized intelligence reports ordered by recency.",
)
def list_reports_endpoint(
    limit: int = Query(50, ge=1, le=100, description="Max reports to return"),
    offset: int = Query(0, ge=0, description="Number of reports to skip"),
    db: Session = Depends(get_db),
):
    service = get_report_service()
    return service.list_reports(db=db, limit=limit, offset=offset)


@report_router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Get intelligence report",
    description="Retrieves a single intelligence report by ID.",
)
def get_report_endpoint(
    report_id: int,
    db: Session = Depends(get_db),
):
    service = get_report_service()
    try:
        return service.get_report(db=db, report_id=report_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
