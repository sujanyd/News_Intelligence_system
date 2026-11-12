"""
Dashboard summary schema.
Provides aggregated metrics across the intelligence platform.
"""

from typing import Dict, Optional
from pydantic import BaseModel, Field


class DashboardSummaryResponse(BaseModel):
    """Aggregated counters and health indicators for dashboard view."""
    total_articles: int = Field(..., description="Total ingested news articles")
    total_sources: int = Field(..., description="Total active news sources")
    total_stories: int = Field(..., description="Total tracked stories")
    total_events: int = Field(..., description="Total detected real-world events")
    total_comparisons: int = Field(..., description="Total completed cross-source comparisons")
    total_reports: int = Field(..., description="Total generated intelligence reports")
    total_flagged_ai_articles: int = Field(..., description="Total articles flagged with AI likelihood >= 0.70")
    embedding_provider: str = Field(..., description="Currently active embedding provider")
    embedding_dimension: int = Field(..., description="Embedding vector dimensionality")
    qdrant_mode: str = Field(..., description="Qdrant storage configuration mode")

