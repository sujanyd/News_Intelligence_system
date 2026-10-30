"""
Pydantic schemas for RSS Feed Ingestion endpoints.

Provides validation and serialization for feed configurations,
ingestion execution requests, and ingestion run summary reports.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class FeedConfigSchema(BaseModel):
    """Configuration for a single news RSS feed."""

    source_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the news publisher or media outlet",
        examples=["BBC News"],
    )
    base_url: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Base website URL of the publisher",
        examples=["https://www.bbc.com"],
    )
    feed_url: str = Field(
        ...,
        min_length=1,
        max_length=1024,
        description="Public RSS or Atom feed URL",
        examples=["https://feeds.bbci.co.uk/news/world/rss.xml"],
    )


class IngestionRunRequest(BaseModel):
    """
    Request payload to trigger an RSS ingestion run.
    All fields are optional; if omitted, the system ingests from default configured feeds.
    """

    feeds: Optional[List[FeedConfigSchema]] = Field(
        default=None,
        description="Optional list of custom RSS feeds to ingest. If omitted, uses default configured feeds.",
    )
    max_articles_per_feed: Optional[int] = Field(
        default=None,
        ge=1,
        le=100,
        description="Optional limit on number of articles to ingest per feed in this run",
        examples=[15],
    )
    timeout: Optional[int] = Field(
        default=None,
        ge=1,
        le=60,
        description="Optional HTTP request timeout in seconds per feed",
        examples=[10],
    )
    max_retries: Optional[int] = Field(
        default=None,
        ge=0,
        le=5,
        description="Optional maximum number of HTTP retries on temporary failures",
        examples=[2],
    )


class FeedResultDetail(BaseModel):
    """Detailed summary of the ingestion outcome for an individual feed."""

    source_name: str = Field(..., description="Publisher name for this feed")
    feed_url: str = Field(..., description="Feed URL processed")
    status: str = Field(..., description="Outcome status: 'success' or 'error'")
    articles_inserted: int = Field(default=0, description="Count of new articles inserted")
    articles_skipped_duplicate: int = Field(default=0, description="Count of duplicate articles skipped")
    retries_attempted: int = Field(default=0, description="Count of HTTP retries attempted for this feed")
    error: Optional[str] = Field(default=None, description="Error message if the feed failed")


class IngestionSummaryResponse(BaseModel):
    """
    Overall execution summary returned by the RSS ingestion run endpoint.
    Aggregates metrics across all attempted feeds without exposing full article content.
    """

    feeds_attempted: int = Field(..., description="Total number of feeds attempted")
    feeds_successful: int = Field(..., description="Number of feeds successfully fetched and parsed")
    articles_inserted: int = Field(..., description="Total new articles inserted into the database")
    articles_skipped_duplicate: int = Field(..., description="Total duplicate articles identified and skipped")
    feed_errors: int = Field(..., description="Total number of feeds that encountered errors")
    feed_retries: int = Field(default=0, description="Total count of HTTP retries attempted across all feeds")
    details: List[FeedResultDetail] = Field(
        default_factory=list,
        description="Per-feed status and counts",
    )

