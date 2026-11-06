"""
Pydantic Schemas for Article Analysis and Content Extraction.

Defines request/response serialization contracts for:
- Topic extraction (ANALYSIS_TOPIC)
- Entity extraction & linking (ENTITY, ANALYSIS_ENTITY)
- Fact extraction (ANALYSIS_FACT)
- Quote extraction (ANALYSIS_QUOTE)
- Article analysis summary & comprehensive extraction response (ARTICLE_ANALYSIS)
"""

from datetime import datetime
from typing import Any, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Topic Schemas
# ---------------------------------------------------------------------------

class TopicResponse(BaseModel):
    """Extracted topic model."""
    id: int = Field(..., description="Unique topic record ID")
    analysis_id: int = Field(..., description="ID of parent article analysis run")
    topic_name: str = Field(..., description="Name or label of the extracted topic")
    relevance_score: Optional[float] = Field(default=None, description="Topic relevance score (0.0 to 1.0)")
    start_char: Optional[int] = Field(default=None, description="Start character offset in text")
    end_char: Optional[int] = Field(default=None, description="End character offset in text")
    evidence_text: Optional[str] = Field(default=None, description="Excerpt from the text demonstrating the topic")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Entity Schemas
# ---------------------------------------------------------------------------

class EntityResponse(BaseModel):
    """Canonical entity definition."""
    id: int = Field(..., description="Unique entity ID")
    name: str = Field(..., description="Canonical entity name")
    entity_type: str = Field(..., description="Entity type: PERSON, ORGANIZATION, LOCATION, etc.")
    description: Optional[str] = Field(default=None, description="Entity description or summary")

    model_config = ConfigDict(from_attributes=True)


class AnalysisEntityResponse(BaseModel):
    """Extracted entity in the context of an article analysis."""
    id: int = Field(..., description="Unique analysis-entity association ID")
    analysis_id: int = Field(..., description="ID of parent article analysis run")
    entity_id: int = Field(..., description="Referenced canonical entity ID")
    entity_name: str = Field(..., description="Name of the entity")
    entity_type: str = Field(..., description="Classification type of the entity")
    mention_count: int = Field(default=1, description="Number of times mentioned in the article")
    sentiment_score: Optional[float] = Field(default=None, description="Targeted sentiment leaning (-1.0 to +1.0)")
    salience_score: Optional[float] = Field(default=None, description="Salience/prominence score (0.0 to 1.0)")
    role: Optional[str] = Field(default=None, description="Role in narrative (e.g., subject, quoted_source)")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Fact Schemas
# ---------------------------------------------------------------------------

class FactResponse(BaseModel):
    """Extracted factual statement."""
    id: int = Field(..., description="Unique fact record ID")
    analysis_id: int = Field(..., description="ID of parent article analysis run")
    fact_statement: str = Field(..., description="Extracted factual claim or assertion")
    verification_status: Optional[str] = Field(
        default="unverified",
        description="Verification flag (e.g. 'unverified', 'verified', 'disputed')",
    )
    confidence_score: Optional[float] = Field(default=None, description="Extraction confidence score (0.0 to 1.0)")
    start_char: Optional[int] = Field(default=None, description="Start character offset in text")
    end_char: Optional[int] = Field(default=None, description="End character offset in text")
    evidence_text: Optional[str] = Field(default=None, description="Original source sentence or phrase")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Quote Schemas
# ---------------------------------------------------------------------------

class QuoteResponse(BaseModel):
    """Extracted quotation statement."""
    id: int = Field(..., description="Unique quote record ID")
    analysis_id: int = Field(..., description="ID of parent article analysis run")
    quote_text: str = Field(..., description="Actual verbatim quote text")
    speaker_name: Optional[str] = Field(default=None, description="Attributed speaker name")
    speaker_title: Optional[str] = Field(default=None, description="Speaker title or role")
    source_type: str = Field(
        default="speaker_opinion",
        description="Distinguishes speaker opinion from journalistic narration",
    )
    is_opinion: bool = Field(default=True, description="Whether statement conveys opinion vs objective fact")
    sentiment_score: Optional[float] = Field(default=None, description="Quotation tone sentiment (-1.0 to +1.0)")
    start_char: Optional[int] = Field(default=None, description="Start character offset in text")
    end_char: Optional[int] = Field(default=None, description="End character offset in text")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Article Analysis Summary & Extraction Details
# ---------------------------------------------------------------------------

class ArticleAnalysisSummaryResponse(BaseModel):
    """Summary of an article analysis run."""
    id: int = Field(..., description="Analysis database ID")
    article_id: int = Field(..., description="Analyzed article ID")
    pipeline_version: str = Field(..., description="Pipeline version used for extraction")
    status: str = Field(..., description="Processing status (e.g. 'completed')")
    bias_score: Optional[float] = Field(default=None, description="Political slant score (-1.0 to +1.0)")
    bias_label: Optional[str] = Field(default=None, description="Political leaning label")
    sentiment_score: Optional[float] = Field(default=None, description="Tone sentiment score (-1.0 to +1.0)")
    sentiment_label: Optional[str] = Field(default=None, description="Sentiment label")
    confidence_score: Optional[float] = Field(default=None, description="Overall extraction confidence score")
    summary: Optional[str] = Field(default=None, description="Brief analytical summary")
    created_at: datetime = Field(..., description="Timestamp when analysis was created")

    model_config = ConfigDict(from_attributes=True)


class ArticleContentExtractionResponse(ArticleAnalysisSummaryResponse):
    """Comprehensive content extraction payload for an article."""
    topics: List[TopicResponse] = Field(default_factory=list, description="Extracted topics")
    entities: List[AnalysisEntityResponse] = Field(default_factory=list, description="Extracted named entities")
    facts: List[FactResponse] = Field(default_factory=list, description="Extracted factual claims")
    quotes: List[QuoteResponse] = Field(default_factory=list, description="Extracted quoted statements")

    model_config = ConfigDict(from_attributes=True)


class ExtractContentRequest(BaseModel):
    """Request payload to trigger content extraction on an article."""
    force_reanalyze: bool = Field(
        default=False,
        description="If True, performs new extraction run even if an existing completed analysis exists",
    )
