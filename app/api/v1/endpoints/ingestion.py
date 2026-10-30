"""
RSS Ingestion API Endpoints.

Provides endpoints to trigger RSS ingestion runs and list configured feeds.
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import DEFAULT_RSS_FEEDS
from app.schemas.ingestion import (
    FeedConfigSchema,
    IngestionRunRequest,
    IngestionSummaryResponse,
)
from app.services.rss_ingestion import run_rss_ingestion

router = APIRouter()


@router.post(
    "/run",
    response_model=IngestionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger RSS ingestion pipeline",
    description=(
        "Collects news articles from configured or custom RSS feeds. "
        "Normalizes URLs, skips duplicates, records content availability, "
        "and saves new articles to PostgreSQL."
    ),
)
def run_ingestion(
    request: IngestionRunRequest = IngestionRunRequest(),
    db: Session = Depends(get_db),
) -> IngestionSummaryResponse:
    """
    Triggers the RSS ingestion pipeline.
    Runs synchronously across configured feeds and returns an aggregated summary of the run.
    """
    custom_feeds = None
    if request.feeds:
        custom_feeds = [feed.model_dump() for feed in request.feeds]

    summary = run_rss_ingestion(
        db=db,
        feeds=custom_feeds,
        max_articles_per_feed=request.max_articles_per_feed,
        timeout=request.timeout,
        max_retries=request.max_retries,
    )
    return summary


@router.get(
    "/feeds",
    response_model=List[FeedConfigSchema],
    summary="List default configured RSS feeds",
    description="Returns the list of default news RSS feeds configured for the ingestion pipeline.",
)
def list_configured_feeds() -> List[FeedConfigSchema]:
    """
    Returns the list of monitored RSS news feeds.
    """
    return [FeedConfigSchema(**feed) for feed in DEFAULT_RSS_FEEDS]

