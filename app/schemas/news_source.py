"""
Pydantic schemas for NewsSource endpoints.

Provides request validation and response serialization models for news publishers.
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class NewsSourceBase(BaseModel):
    """Base fields shared across NewsSource models."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Unique name of the news source or media organization",
        examples=["Reuters", "BBC News", "The Hindu"],
    )
    base_url: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Root website URL for the source",
        examples=["https://www.reuters.com", "https://www.bbc.com"],
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_and_validate_name(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Source name cannot be blank")
        return v

    @field_validator("base_url", mode="before")
    @classmethod
    def validate_base_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("Base URL must start with http:// or https://")
        return v


class NewsSourceCreate(NewsSourceBase):
    """Request payload for creating a new news source."""
    pass


class NewsSourceResponse(NewsSourceBase):
    """Response model for a news source."""
    id: int = Field(..., description="Unique database identifier for the news source")
    created_at: datetime = Field(..., description="Timestamp when the source was registered")

    model_config = ConfigDict(from_attributes=True)
