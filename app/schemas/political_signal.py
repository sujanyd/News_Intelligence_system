"""
Pydantic Schemas for Political and Party-Leaning Signal Analysis.

Defines schemas for:
- Political entities (parties, politicians, governmental/political organizations)
- Article-level political presentation signals (favorable, unfavorable, neutral treatment per entity)
- Article political leaning evaluation (composite slant, partisanship, leaning category)
- Comparison-level political coverage signals (COMPARISON_POLITICAL_SIGNAL)
- Comparison session political leaning synthesis across multiple news sources
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


PoliticalLeaningCategory = Literal["left", "center-left", "center", "center-right", "right"]
PoliticalEntityType = Literal["POLITICAL_PARTY", "POLITICIAN", "POLITICAL_ORGANIZATION"]
EntitySentimentPresentation = Literal["favorable", "unfavorable", "neutral", "mixed"]


# ---------------------------------------------------------------------------
# 1. Political Entity Schemas
# ---------------------------------------------------------------------------

class PoliticalEntityResponse(BaseModel):
    """
    Schema for a recognized political entity (from ENTITY).
    """
    id: int = Field(..., description="Canonical entity ID")
    name: str = Field(..., description="Canonical entity name")
    entity_type: str = Field(..., description="Entity classification (e.g. 'ORGANIZATION', 'PERSON', 'GOVERNMENT')")
    political_category: PoliticalEntityType = Field(
        ...,
        description="Political subcategory: 'POLITICAL_PARTY', 'POLITICIAN', or 'POLITICAL_ORGANIZATION'",
    )
    ideological_affiliation: Optional[str] = Field(
        default=None,
        description="Known political affiliation (e.g. 'Democratic Party', 'Republican Party', 'Labour Party')",
    )
    mention_count: int = Field(default=1, description="Frequency of mentions within the article")
    salience_score: Optional[float] = Field(default=None, description="Prominence within the article (0.0 to 1.0)")
    sentiment_score: Optional[float] = Field(default=None, description="Local sentiment score towards this entity (-1.0 to +1.0)")
    presentation: EntitySentimentPresentation = Field(
        default="neutral",
        description="Presentation assessment: 'favorable', 'unfavorable', 'neutral', or 'mixed'",
    )

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# 2. Political Presentation Signal Schemas (Article-Level)
# ---------------------------------------------------------------------------

class PoliticalPresentationSignal(BaseModel):
    """
    Specific evidence-based signal indicating how a political entity is presented.
    """
    entity_id: Optional[int] = Field(default=None, description="Referenced entity ID if resolved")
    entity_name: str = Field(..., description="Name of the political entity being discussed")
    political_category: PoliticalEntityType = Field(..., description="Entity classification")
    treatment: EntitySentimentPresentation = Field(..., description="Favorable, unfavorable, neutral, or mixed")
    framing_technique: str = Field(
        ...,
        description="Framing technique applied (e.g., 'praise_achievement', 'criticism_scrutiny', 'blame_attribution', 'policy_support')",
    )
    intensity_score: float = Field(..., description="Signal strength between 0.0 and 1.0")
    confidence_score: float = Field(..., description="Confidence of this estimate between 0.0 and 1.0")
    evidence_text: str = Field(..., description="Verbatim sentence or clause serving as evidence")
    start_char: Optional[int] = Field(default=None, description="Character start offset in text")
    end_char: Optional[int] = Field(default=None, description="Character end offset in text")
    explanation: str = Field(..., description="Explanation citing why this presentation signal was identified")


class ArticlePoliticalSignalResponse(BaseModel):
    """
    Response model for an article's political signals and estimated ideological slant.
    """
    article_id: int = Field(..., description="Article ID")
    headline: str = Field(..., description="Article headline")
    political_leaning: PoliticalLeaningCategory = Field(
        ...,
        description="Estimated political leaning ('left', 'center-left', 'center', 'center-right', 'right')",
    )
    slant_score: float = Field(
        ...,
        description="Quantitative ideological slant (-1.0 Far-Left to +1.0 Far-Right, 0.0 Center)",
    )
    partisanship_score: float = Field(
        ...,
        description="Partisanship intensity (0.0 Highly Neutral to 1.0 Highly Partisan)",
    )
    confidence_score: float = Field(..., description="Confidence score for this estimate (0.0 to 1.0)")
    signal_description: str = Field(..., description="Descriptive summary of detected political cues")
    political_entities: List[PoliticalEntityResponse] = Field(
        default_factory=list,
        description="Political parties, politicians, and organizations identified in this article",
    )
    signals: List[PoliticalPresentationSignal] = Field(
        default_factory=list,
        description="Evidence-backed presentation signals found in article content",
    )
    analyzed_at: datetime = Field(..., description="Timestamp of analysis evaluation")


# ---------------------------------------------------------------------------
# 3. Comparison Political Signal Schemas (COMPARISON_POLITICAL_SIGNAL)
# ---------------------------------------------------------------------------

class ComparisonPoliticalSignalResponse(BaseModel):
    """
    Schema representing a COMPARISON_POLITICAL_SIGNAL row.
    """
    id: int = Field(..., description="Unique record ID")
    comparison_id: int = Field(..., description="Comparison ID")
    article_id: int = Field(..., description="Article ID")
    political_leaning: str = Field(..., description="Political classification ('left', 'center-left', 'center', etc.)")
    slant_score: Optional[float] = Field(default=None, description="Quantitative slant score (-1.0 to +1.0)")
    partisanship_score: Optional[float] = Field(default=None, description="Partisanship intensity (0.0 to 1.0)")
    signal_description: Optional[str] = Field(default=None, description="Description of political signals detected")
    created_at: datetime = Field(..., description="Creation timestamp")

    # Enriched details
    article_title: Optional[str] = Field(default=None, description="Title of the article")
    source_name: Optional[str] = Field(default=None, description="Name of the publishing news source")
    evidence_signals: List[PoliticalPresentationSignal] = Field(
        default_factory=list,
        description="Granular presentation evidence supporting this comparison signal",
    )

    model_config = ConfigDict(from_attributes=True)


class ComparisonPoliticalCoverageResponse(BaseModel):
    """
    Multi-article comparative political analysis response.
    Compares how different news outlets cover the same event/story politically.
    """
    comparison_id: int = Field(..., description="Comparison ID")
    comparison_title: str = Field(..., description="Title of the comparison session")
    status: str = Field(..., description="Comparison status ('completed', 'processing', etc.)")
    event_id: Optional[int] = Field(default=None, description="Referenced Event ID if applicable")
    article_count: int = Field(default=0, description="Number of articles analyzed in this comparison")
    signals: List[ComparisonPoliticalSignalResponse] = Field(
        default_factory=list,
        description="Political signals for each article in this comparison",
    )
    diversity_summary: str = Field(
        ...,
        description="Overview of ideological range, convergence, and divergence observed across outlets",
    )


class AnalyzePoliticalSignalsRequest(BaseModel):
    """Request payload to trigger political signal analysis."""
    force_reanalyze: bool = Field(
        default=False,
        description="If True, re-computes political signals and updates database records",
    )
    comparison_id: Optional[int] = Field(
        default=None,
        description="Optional comparison ID to link or update in COMPARISON_POLITICAL_SIGNAL",
    )
