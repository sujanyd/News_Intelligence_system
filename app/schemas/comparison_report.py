"""
Pydantic Schemas for Cross-Source News Comparison and Evidence-Based Reporting.

Covers:
- News Comparison sessions (NEWS_COMPARISON)
- Comparative coverage and depth (COMPARISON_COVERAGE)
- Comparative evidence and divergence (COMPARISON_EVIDENCE)
- Comprehensive multi-source comparison responses
- Intelligence Reports (REPORT)
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.article import ArticleSummaryResponse
from app.schemas.political_signal import ComparisonPoliticalSignalResponse


ComparisonStatusType = Literal["pending", "processing", "completed", "failed"]
EvidenceType = Literal["framing_contrast", "omission", "tone_discrepancy", "headline_bias", "quote_selection", "factual_divergence"]
ReportFormatType = Literal["markdown", "html", "json"]


# ---------------------------------------------------------------------------
# 1. Comparison Evidence Schemas
# ---------------------------------------------------------------------------

class ComparisonEvidenceBase(BaseModel):
    """Base fields for an item of comparative evidence."""
    evidence_type: str = Field(
        ...,
        description="Type of evidence ('framing_contrast', 'omission', 'tone_discrepancy', 'headline_bias', 'quote_selection', etc.)",
    )
    claim_or_topic: Optional[str] = Field(default=None, description="Topic or claim the evidence relates to")
    content: str = Field(..., description="Detailed excerpt or explanation of comparative divergence")
    start_char: Optional[int] = Field(default=None, description="Start character offset in source article")
    end_char: Optional[int] = Field(default=None, description="End character offset in source article")


class ComparisonEvidenceResponse(ComparisonEvidenceBase):
    """Response model for a comparative evidence item."""
    id: int = Field(..., description="Unique evidence ID")
    comparison_id: int = Field(..., description="Parent comparison session ID")
    article_id: Optional[int] = Field(default=None, description="Referenced article ID if source-specific")
    created_at: datetime = Field(..., description="Record creation timestamp")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# 2. Comparison Coverage Schemas
# ---------------------------------------------------------------------------

class ComparisonCoverageResponse(BaseModel):
    """Response model for per-article comparative coverage evaluation."""
    id: int = Field(..., description="Coverage record ID")
    comparison_id: int = Field(..., description="Parent comparison session ID")
    article_id: int = Field(..., description="Evaluated article ID")
    coverage_score: Optional[float] = Field(default=None, description="Coverage depth score (0.0 to 1.0)")
    tone_score: Optional[float] = Field(default=None, description="Measured tone valence (-1.0 to +1.0)")
    primary_frame: Optional[str] = Field(default=None, description="Dominant narrative framing category")
    omitted_topics: Optional[str] = Field(default=None, description="Summary of topics omitted relative to peers")
    created_at: datetime = Field(..., description="Record creation timestamp")

    # Enriched article metadata
    article_title: Optional[str] = Field(default=None, description="Article title")
    source_name: Optional[str] = Field(default=None, description="Publishing outlet name")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# 3. News Comparison Session Schemas
# ---------------------------------------------------------------------------

class NewsComparisonCreate(BaseModel):
    """Request payload to initiate or define a News Comparison session."""
    title: str = Field(..., min_length=1, max_length=512, description="Title of the comparison session")
    description: Optional[str] = Field(default=None, description="Contextual description of the comparison scope")
    event_id: Optional[int] = Field(default=None, description="Event ID whose articles should be compared")
    article_ids: Optional[List[int]] = Field(default=None, description="Specific article IDs to compare (minimum 2)")


class NewsComparisonSummaryResponse(BaseModel):
    """Summary representation of a comparison session."""
    id: int = Field(..., description="Unique comparison session ID")
    event_id: Optional[int] = Field(default=None, description="Associated event ID")
    title: str = Field(..., description="Title of the comparison")
    description: Optional[str] = Field(default=None, description="Description")
    status: str = Field(..., description="Processing status ('completed', 'processing', etc.)")
    article_count: int = Field(default=0, description="Total articles included in comparison")
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class NewsComparisonDetailResponse(NewsComparisonSummaryResponse):
    """Detailed comparison response with articles, coverage, evidences, and political signals."""
    articles: List[ArticleSummaryResponse] = Field(default_factory=list, description="Articles compared in this session")
    coverages: List[ComparisonCoverageResponse] = Field(default_factory=list, description="Coverage depth assessments")
    evidences: List[ComparisonEvidenceResponse] = Field(default_factory=list, description="Comparative evidence items")
    political_signals: List[ComparisonPoliticalSignalResponse] = Field(
        default_factory=list,
        description="Political leaning signals across compared articles",
    )
    synthesis_summary: Optional[str] = Field(
        default=None,
        description="Executive analytical synthesis of similarities and differences",
    )

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# 4. Evidence-Based Report Schemas (REPORT)
# ---------------------------------------------------------------------------

class ReportCreateRequest(BaseModel):
    """Request payload to generate an analytical intelligence report."""
    comparison_id: int = Field(..., description="ID of the completed comparison session to synthesize")
    title: Optional[str] = Field(default=None, description="Custom title for the report")
    report_format: ReportFormatType = Field(default="markdown", description="Output format ('markdown', 'html', 'json')")


class ReportResponse(BaseModel):
    """Response model for a synthesized evidence-based intelligence report."""
    id: int = Field(..., description="Unique report ID")
    comparison_id: int = Field(..., description="Referenced comparison session ID")
    title: str = Field(..., description="Report title")
    summary: Optional[str] = Field(default=None, description="Executive summary")
    content: str = Field(..., description="Full synthesized report content in Markdown/HTML/JSON")
    report_format: str = Field(default="markdown", description="Format of the report body")
    created_at: datetime = Field(..., description="Timestamp when report was generated")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# 5. Duplicate Detection Schemas
# ---------------------------------------------------------------------------

class DuplicateCheckResponse(BaseModel):
    """Diagnostic response for duplicate/near-duplicate detection."""
    article_id: int = Field(..., description="Target article ID")
    is_duplicate: bool = Field(..., description="Whether a duplicate was identified")
    duplicate_type: Literal["exact", "near_duplicate", "none"] = Field(..., description="Type of duplicate relationship")
    canonical_article_id: Optional[int] = Field(default=None, description="Canonical original article ID")
    similarity_score: float = Field(..., description="Similarity score with canonical article")
    reason: str = Field(..., description="Justification and criteria explanation")
