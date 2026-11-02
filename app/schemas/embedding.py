"""
Pydantic schemas for Article Embedding Endpoints.

Defines schemas for triggering embedding generation runs, reporting per-article results,
and returning structured summary metrics without leaking high-dimensional vector floats into API responses.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class EmbeddingGenerateRequest(BaseModel):
    """
    Request payload to trigger embedding generation.
    All parameters are optional and fall back to application settings.
    """

    article_ids: Optional[List[int]] = Field(
        default=None,
        description="Optional list of specific Article IDs to generate embeddings for. If omitted, processes all eligible articles.",
        examples=[[1, 2, 3]],
    )
    embedding_type: str = Field(
        default="headline",
        description="Type of embedding to generate ('headline', 'body', or 'all')",
        examples=["headline"],
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerates and updates embeddings even if one already exists for the model/type",
    )
    limit: Optional[int] = Field(
        default=None,
        ge=1,
        le=500,
        description="Maximum number of articles to process in this run",
        examples=[50],
    )


class ArticleEmbeddingResultDetail(BaseModel):
    """Status details for an individual article embedding attempt."""

    article_id: int = Field(..., description="ID of the article processed")
    embedding_type: str = Field(..., description="Type of embedding ('headline' or 'body')")
    status: str = Field(..., description="Outcome: 'generated', 'skipped', or 'error'")
    model_name: str = Field(..., description="Model identifier used for embedding")
    vector_reference: Optional[str] = Field(default=None, description="Vector ID reference for vector database lookup")
    dimensions: Optional[int] = Field(default=None, description="Dimensionality of generated vector")
    error: Optional[str] = Field(default=None, description="Error message if generation failed")


class EmbeddingGenerateSummaryResponse(BaseModel):
    """
    Summary response for the embedding generation endpoint.
    Aggregates metrics without returning high-dimensional float vectors directly in HTTP responses.
    """

    status: str = Field(default="completed", description="Overall execution status")
    embedding_type: str = Field(..., description="Requested embedding type")
    model_name: str = Field(..., description="Model name used for embeddings")
    articles_considered: int = Field(default=0, description="Total number of articles evaluated")
    embeddings_generated: int = Field(default=0, description="Total new embeddings successfully generated and recorded")
    articles_skipped: int = Field(default=0, description="Total articles skipped (empty text or already embedded)")
    errors_encountered: int = Field(default=0, description="Total errors encountered")
    details: List[ArticleEmbeddingResultDetail] = Field(
        default_factory=list,
        description="Detailed outcome per article",
    )

