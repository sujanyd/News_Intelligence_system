"""
Pydantic schemas for Article Pair Matching and Classification.

Covers:
- Request schemas for triggering matching/classification on an article.
- Classification label types: 'SAME', 'RELATED', 'DIFFERENT'.
- Detailed match result responses with relational metadata, confidence, and decision signals.
- Match summary statistics.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

MatchLabelType = Literal["SAME", "RELATED", "DIFFERENT"]


class ArticleMatchSignalDetail(BaseModel):
    """
    Detailed diagnostic signals contributing to the pairwise classification decision.
    Helpful for researchers and students inspecting why a pair was classified.
    """
    headline_similarity: Optional[float] = Field(None, description="Cosine similarity of headline embeddings")
    body_similarity: Optional[float] = Field(None, description="Cosine similarity of body embeddings")
    entity_overlap_score: float = Field(..., description="Jaccard or weighted entity overlap score (0.0 to 1.0)")
    shared_entities: List[str] = Field(default_factory=list, description="List of recognized entities found in both articles")
    publication_time_diff_hours: Optional[float] = Field(None, description="Absolute difference in publication hours")
    event_id_match: bool = Field(False, description="Whether both articles share the exact same foreign key Event ID")
    same_story_id: bool = Field(False, description="Whether both articles map to the same overarching Story ID")
    classification_method: str = Field(..., description="Algorithm or rule pathway used (e.g., 'multi_signal_rules_v1')")


class ArticleMatchResponse(BaseModel):
    """
    Response schema for a single article match pair.
    """
    id: int = Field(..., description="ID of the ArticleMatch record in PostgreSQL")
    article_id_1: int = Field(..., description="Canonical first article ID (lower ID)")
    article_id_2: int = Field(..., description="Canonical second article ID (higher ID)")
    match_label: MatchLabelType = Field(..., description="Classification: SAME, RELATED, or DIFFERENT")
    similarity_score: Optional[float] = Field(None, description="Combined quantitative similarity score (0.0 to 1.0)")
    confidence_score: Optional[float] = Field(None, description="Decision confidence score (0.0 to 1.0)")
    model_name: Optional[str] = Field(None, description="Algorithm or classifier model version name")
    created_at: datetime = Field(..., description="Timestamp when the match record was created")

    # Additional contextual metadata for convenience
    article_1_title: Optional[str] = Field(None, description="Title of the first article")
    article_2_title: Optional[str] = Field(None, description="Title of the second article")
    article_1_source: Optional[str] = Field(None, description="Source name of the first article")
    article_2_source: Optional[str] = Field(None, description="Source name of the second article")
    signals: Optional[ArticleMatchSignalDetail] = Field(None, description="Diagnostic signals if requested/available")

    model_config = ConfigDict(from_attributes=True)


class ArticleMatchRequest(BaseModel):
    """
    Request schema to trigger pairwise matching for a target article.
    """
    candidate_limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum similar candidates to retrieve from vector database",
    )
    score_threshold: Optional[float] = Field(
        default=0.2,
        ge=-1.0,
        le=1.0,
        description="Minimum vector similarity threshold for candidate selection",
    )
    force_reclassify: bool = Field(
        default=False,
        description="Whether to overwrite existing ArticleMatch records for evaluated pairs",
    )


class ArticleMatchSummaryResponse(BaseModel):
    """
    Summary response after running pair classification for an article.
    """
    query_article_id: int = Field(..., description="Target article ID evaluated")
    query_title: str = Field(..., description="Title of the evaluated target article")
    candidates_retrieved: int = Field(..., description="Total candidate articles retrieved via vector DB")
    matches_created: int = Field(..., description="Number of new match records inserted")
    matches_updated: int = Field(..., description="Number of existing match records updated")
    matches_skipped: int = Field(..., description="Number of existing match records retained")
    matches: List[ArticleMatchResponse] = Field(
        default_factory=list,
        description="List of classified match pair results",
    )
