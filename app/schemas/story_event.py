"""
Pydantic Schemas for Story and Event Models.

Provides validation and serialization models for:
- Story (overarching narrative / continuing coverage)
- Event (specific localized real-world occurrence linked to a Story)
- Grouping request payloads and response summaries
"""

from datetime import datetime
from typing import Any, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.article import ArticleSummaryResponse


TimePrecisionType = Literal["exact", "date", "range", "unknown"]


# ---------------------------------------------------------------------------
# Event Schemas
# ---------------------------------------------------------------------------

class EventBase(BaseModel):
    """Base fields shared across Event schemas."""
    story_id: int = Field(..., description="ID of the parent Story this event belongs to")
    event_time: Optional[datetime] = Field(
        default=None,
        description="The actual timestamp when the real-world incident occurred",
    )
    event_time_precision: TimePrecisionType = Field(
        default="unknown",
        description="Precision of the event timestamp ('exact', 'date', 'range', 'unknown')",
    )
    event_time_disagreement: bool = Field(
        default=False,
        description="True if different news sources report conflicting timelines for this event",
    )


class EventCreate(EventBase):
    """Request payload for creating a new Event manually or programmatically."""
    pass


class EventUpdate(BaseModel):
    """Request payload for updating an existing Event."""
    story_id: Optional[int] = Field(default=None, description="Updated parent story ID")
    event_time: Optional[datetime] = Field(default=None, description="Updated event occurrence time")
    event_time_precision: Optional[TimePrecisionType] = Field(default=None, description="Updated precision")
    event_time_disagreement: Optional[bool] = Field(default=None, description="Conflict flag")


class EventResponse(BaseModel):
    """Response model for an Event without embedded articles."""
    id: int = Field(..., description="Event database ID")
    story_id: int = Field(..., description="Parent story database ID")
    event_time: Optional[datetime] = Field(default=None, description="Event occurrence time")
    event_time_precision: str = Field(default="unknown", description="Precision of occurrence time")
    event_time_disagreement: bool = Field(default=False, description="Whether sources disagree on timeline")
    article_count: int = Field(default=0, description="Total number of articles mapped to this event")

    model_config = ConfigDict(from_attributes=True)


class EventDetailResponse(EventResponse):
    """Response model for an Event including list of mapped articles."""
    story_title: Optional[str] = Field(default=None, description="Title of the parent story")
    articles: List[ArticleSummaryResponse] = Field(default_factory=list, description="Articles linked to this event")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Story Schemas
# ---------------------------------------------------------------------------

class StoryBase(BaseModel):
    """Base fields shared across Story schemas."""
    title: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Title or label of the overarching news story",
        examples=["Global Clean Energy Summit 2026"],
    )

    @field_validator("title", mode="before")
    @classmethod
    def strip_and_validate_title(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Story title cannot be empty")
        return v


class StoryCreate(StoryBase):
    """Request payload for creating a new Story."""
    pass


class StoryUpdate(BaseModel):
    """Request payload for updating an existing Story."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=512)

    @field_validator("title", mode="before")
    @classmethod
    def strip_and_validate_title(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Story title cannot be empty")
        return v


class StoryResponse(BaseModel):
    """Response model for a Story in list views."""
    id: int = Field(..., description="Story database ID")
    title: str = Field(..., description="Title of the story")
    created_at: datetime = Field(..., description="Timestamp when story was created")
    event_count: int = Field(default=0, description="Total events under this story")
    article_count: int = Field(default=0, description="Total articles linked across all events in this story")

    model_config = ConfigDict(from_attributes=True)


class StoryDetailResponse(StoryResponse):
    """Response model for Story details with events and recent articles."""
    events: List[EventResponse] = Field(default_factory=list, description="Events belonging to this story")
    articles: List[ArticleSummaryResponse] = Field(default_factory=list, description="Articles mapped to events in this story")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Story and Event Grouping Pipeline Schemas
# ---------------------------------------------------------------------------

class GroupArticleRequest(BaseModel):
    """Payload to trigger grouping for a specific article or batch of articles."""
    article_id: int = Field(..., description="ID of the article to group into a story and event")
    force_regroup: bool = Field(default=False, description="If True, re-evaluates even if already grouped")


class GroupArticleResult(BaseModel):
    """Diagnostic result of grouping an article."""
    article_id: int = Field(..., description="ID of the grouped article")
    story_id: int = Field(..., description="Assigned Story ID")
    story_title: str = Field(..., description="Assigned Story title")
    story_action: Literal["reused", "created"] = Field(..., description="Whether story was reused or created new")
    event_id: int = Field(..., description="Assigned Event ID")
    event_action: Literal["reused", "created"] = Field(..., description="Whether event was reused or created new")
    reason: str = Field(..., description="Explanation of grouping evidence and decision")
    matched_article_id: Optional[int] = Field(default=None, description="Anchor article ID that provided evidence")
