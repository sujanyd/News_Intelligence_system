"""
Pydantic Schemas for AI-Generated News Text Detection.

Provides validation and serialization models for:
- Statistical AI-generated likelihood estimation (0.0 to 1.0)
- Burstiness and vocabulary uniformity metrics
- Human editorial review flagging
- Model metadata and version tracking
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AIDetectionMetricDetails(BaseModel):
    """Granular statistical metrics behind the AI likelihood estimate."""
    burstiness_score: float = Field(..., description="Sentence length variation score (higher = more human-like variation)")
    lexical_uniformity: float = Field(..., description="Type-token uniformity metric (0.0 to 1.0)")
    sentence_count: int = Field(..., description="Total sentences evaluated")
    average_sentence_length: float = Field(..., description="Average words per sentence")
    repetition_index: float = Field(..., description="N-gram repetition index")
    methodology: str = Field(..., description="Brief description of the statistical estimation method")


class AIDetectionResponse(BaseModel):
    """
    Schema representing an AI_DETECTION_RESULT record.
    Presents the estimated likelihood of machine-generated text.
    """
    id: int = Field(..., description="Unique AI detection record ID")
    article_id: int = Field(..., description="Target article ID")
    ai_likelihood: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Estimated probability that text was machine-generated (0.0 to 1.0)",
    )
    confidence_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence level in the estimation (0.0 to 1.0)",
    )
    model_name: str = Field(..., description="Name of the detector model or heuristic engine")
    model_version: Optional[str] = Field(default=None, description="Detector model version")
    is_flagged_for_review: bool = Field(
        default=False,
        description="Whether this article is flagged for human editorial verification",
    )
    analysis_details: Optional[str] = Field(
        default=None,
        description="Raw JSON serialization of metrics or features",
    )
    metrics: Optional[AIDetectionMetricDetails] = Field(
        default=None,
        description="Structured statistical metrics",
    )
    interpretation: str = Field(..., description="Explanatory interpretation of the likelihood score")
    limitations: str = Field(
        ...,
        description="Disclaimer regarding detection uncertainty and false-positive risk",
    )
    created_at: datetime = Field(..., description="Analysis timestamp")

    model_config = ConfigDict(from_attributes=True)


class AnalyzeAIDetectionRequest(BaseModel):
    """Request payload to trigger AI text likelihood evaluation."""
    force_reanalyze: bool = Field(
        default=False,
        description="If True, re-computes estimation and overwrites existing record",
    )
    flag_threshold: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description="Likelihood threshold at which is_flagged_for_review is set to True",
    )

