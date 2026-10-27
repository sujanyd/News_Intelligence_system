"""
Pydantic schemas for data validation and serialization.
"""

from app.schemas.health import HealthCheckResponse
from app.schemas.news_source import (
    NewsSourceBase,
    NewsSourceCreate,
    NewsSourceResponse,
)
from app.schemas.article import (
    ArticleBase,
    ArticleCreate,
    ArticleSummaryResponse,
    ArticleDetailResponse,
)

__all__ = [
    "HealthCheckResponse",
    "NewsSourceBase",
    "NewsSourceCreate",
    "NewsSourceResponse",
    "ArticleBase",
    "ArticleCreate",
    "ArticleSummaryResponse",
    "ArticleDetailResponse",
]
