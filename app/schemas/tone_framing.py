"""
Pydantic Schemas for Tone and Framing Analysis.

Provides validation and response serialization models for:
- Article tone and tone confidence
- Headline framing and rhetorical patterns
- Article-level framing signals with supporting evidence and offsets
- Composite tone & framing analysis response payloads
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


ToneCategory = Literal["neutral", "positive", "negative", "critical", "alarming", "optimistic", "contentious"]

HeadlineFramingType = Literal[
    "neutral_reporting",
    "emotional_language",
    "conflict_emphasis",
    "blame_attribution",
    "urgency",
    "economic_consequence",
    "achievement_progress",
]

FramingSignalType = Literal[
    "emotional_language",
    "conflict_emphasis",
    "blame_attribution",
    "urgency",
    "economic_consequence",
    "humanitarian_angle",
    "security_threat",
    "cooperative_progress",
    "loaded_language",
]


class FramingSignalResponse(BaseModel):
    """
    Schema for an individual framing signal (ANALYSIS_FRAMING_SIGNAL).
    Includes specific text evidence, character boundaries, intensity, and explanation.
    """
    id: int = Field(..., description="Unique framing signal ID")
    analysis_id: int = Field(..., description="ID of parent article analysis run")
    frame_type: str = Field(
        ...,
        description="Frame category (e.g. 'conflict_emphasis', 'urgency', 'blame_attribution', 'economic_consequence')",
    )
    intensity_score: Optional[float] = Field(
        default=None,
        description="Intensity or strength of the framing cue (0.0 to 1.0)",
    )
    evidence_text: str = Field(..., description="Verbatim text excerpt demonstrating the framing signal")
    start_char: Optional[int] = Field(default=None, description="Start character offset within article text")
    end_char: Optional[int] = Field(default=None, description="End character offset within article text")
    explanation: Optional[str] = Field(default=None, description="Contextual explanation for why this signal was identified")
    created_at: datetime = Field(..., description="Timestamp when signal record was created")

    model_config = ConfigDict(from_attributes=True)


class ArticleToneResponse(BaseModel):
    """
    Schema for article overall tone assessment.
    """
    article_id: int = Field(..., description="Target article ID")
    analysis_id: int = Field(..., description="ID of associated article analysis record")
    tone: ToneCategory = Field(..., description="Primary tone category ('neutral', 'positive', 'negative', 'critical', 'alarming', etc.)")
    tone_score: float = Field(..., description="Continuous valence score (-1.0 to +1.0)")
    confidence: float = Field(..., description="Confidence score of tone estimate (0.0 to 1.0)")
    explanation: str = Field(..., description="Explanation of tone evaluation based on lexical evidence")
    subjectivity_score: Optional[float] = Field(default=None, description="Degree of subjective vs objective phrasing (0.0 to 1.0)")


class HeadlineFramingResponse(BaseModel):
    """
    Schema for headline framing analysis.
    """
    article_id: int = Field(..., description="Target article ID")
    headline: str = Field(..., description="Analyzed headline text")
    primary_frame: HeadlineFramingType = Field(..., description="Dominant framing pattern of the headline")
    detected_frames: List[HeadlineFramingType] = Field(default_factory=list, description="All detected framing techniques")
    confidence: float = Field(..., description="Confidence in headline framing assessment (0.0 to 1.0)")
    evidence_phrases: List[str] = Field(default_factory=list, description="Specific words or phrases in headline indicating framing")
    explanation: str = Field(..., description="Explanation of the framing technique used in the headline")


class ToneAndFramingAnalysisResponse(BaseModel):
    """
    Comprehensive payload containing article tone, headline framing, and all article framing signals.
    """
    article_id: int = Field(..., description="Target article ID")
    analysis_id: int = Field(..., description="Associated article analysis ID")
    headline: str = Field(..., description="Article headline")
    tone: ArticleToneResponse = Field(..., description="Overall article tone assessment")
    headline_framing: HeadlineFramingResponse = Field(..., description="Headline-specific framing analysis")
    framing_signals: List[FramingSignalResponse] = Field(
        default_factory=list,
        description="Detailed list of framing signals detected throughout the article",
    )
    total_signals_count: int = Field(default=0, description="Total number of framing signals identified")
    summary: str = Field(..., description="Executive summary of the tone and framing profile")


class AnalyzeToneFramingRequest(BaseModel):
    """Request payload to trigger tone and framing analysis."""
    force_reanalyze: bool = Field(
        default=False,
        description="If True, re-analyzes and replaces existing framing signals for this article",
    )
