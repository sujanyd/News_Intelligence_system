"""
Pydantic schemas for Article endpoints.

Provides request validation and response serialization models for news articles.
Separates lightweight summary listings from detailed single-article views.
"""

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


ContentAvailabilityType = Literal["full_text", "summary_only", "headline_only"]


class ArticleBase(BaseModel):
    """Base fields shared across Article models."""
    title: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Headline or title of the article",
        examples=["Central Bank Announces Interest Rate Decision"],
    )
    url: str = Field(
        ...,
        min_length=1,
        max_length=1024,
        description="Public URL where the article was originally published",
        examples=["https://www.reuters.com/business/finance/central-bank-rate-2026-10-27/"],
    )
    content_availability: ContentAvailabilityType = Field(
        default="full_text",
        description="Level of content available ('full_text', 'summary_only', 'headline_only')",
    )
    published_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp when the article was originally published by the source",
    )

    @field_validator("title", mode="before")
    @classmethod
    def strip_and_validate_title(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Article title cannot be blank")
        return v

    @field_validator("url", mode="before")
    @classmethod
    def validate_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("URL must start with http:// or https://")
        return v


class ArticleCreate(ArticleBase):
    """
    Request payload for manually creating an article.
    Used for testing, ingestion pipelines, or manual submissions.
    """
    source_id: int = Field(..., description="ID of the news source publishing this article")
    content: Optional[str] = Field(
        default=None,
        description="Full text content or body of the article",
    )
    event_id: Optional[int] = Field(
        default=None,
        description="Optional ID of the real-world event this article covers",
    )
    canonical_url: Optional[str] = Field(
        default=None,
        max_length=1024,
        description="Canonical URL if syndicated or republished",
    )

    @field_validator("canonical_url", mode="before")
    @classmethod
    def validate_canonical_url(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("Canonical URL must start with http:// or https://")
        return v


class ArticleSummaryResponse(BaseModel):
    """
    Lightweight summary model for listing articles.
    Excludes the heavy article body content to optimize network payloads and memory.
    """
    id: int = Field(..., description="Unique database identifier for the article")
    source_id: int = Field(..., description="ID of the news source publishing this article")
    source_name: Optional[str] = Field(default=None, description="Name of the news source")
    event_id: Optional[int] = Field(default=None, description="Associated event ID if mapped")
    title: str = Field(..., description="Article headline")
    url: str = Field(..., description="Article URL")
    content_availability: str = Field(..., description="Content availability status")
    published_at: Optional[datetime] = Field(default=None, description="Original publication timestamp")
    retrieved_at: datetime = Field(..., description="Timestamp when article was scraped/retrieved")
    created_at: datetime = Field(..., description="Database record creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class ArticleDetailResponse(ArticleSummaryResponse):
    """
    Comprehensive article model for single-article retrieval.
    Includes the full article body text and duplicate detection metadata.
    """
    content: Optional[str] = Field(default=None, description="Full body text of the article")
    canonical_url: Optional[str] = Field(default=None, description="Canonical syndication URL")
    content_hash: Optional[str] = Field(default=None, description="SHA-256 hash of the content")
    duplicate_of_article_id: Optional[int] = Field(
        default=None,
        description="ID of the primary article if this is detected as a duplicate",
    )

    model_config = ConfigDict(from_attributes=True)
