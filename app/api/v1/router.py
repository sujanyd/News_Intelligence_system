"""
API v1 Central Router.

Combines all sub-routers (health, sources, articles) into a single central router.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    sources,
    articles,
    ingestion,
    embeddings,
    similarity,
    matching,
    stories,
    events,
    content_extraction,
    tone_framing,
    political_signal,
    comparison_report,
)

api_v1_router = APIRouter()

# Register endpoints under API v1
api_v1_router.include_router(health.router)
api_v1_router.include_router(sources.router, prefix="/sources", tags=["News Sources"])
api_v1_router.include_router(articles.router, prefix="/articles", tags=["Articles"])
api_v1_router.include_router(comparison_report.duplicate_router, prefix="/articles", tags=["Duplicate Detection"])
api_v1_router.include_router(content_extraction.router, prefix="/articles", tags=["Article Content Extraction"])
api_v1_router.include_router(tone_framing.router, prefix="/articles", tags=["Tone and Framing Analysis"])
api_v1_router.include_router(political_signal.article_router, prefix="/articles", tags=["Political Leaning Signals"])
api_v1_router.include_router(political_signal.comparison_router, prefix="/comparisons", tags=["Political Leaning Signals"])
api_v1_router.include_router(comparison_report.comparison_router, prefix="/comparisons", tags=["News Comparisons"])
api_v1_router.include_router(comparison_report.report_router, prefix="/reports", tags=["Evidence-Based Reports"])
api_v1_router.include_router(ingestion.router, prefix="/ingestion", tags=["RSS Ingestion"])
api_v1_router.include_router(embeddings.router, prefix="/embeddings", tags=["Article Embeddings"])
api_v1_router.include_router(similarity.router, prefix="/similarity", tags=["Similarity Search"])
api_v1_router.include_router(matching.router, tags=["Article Matching & Classification"])
api_v1_router.include_router(stories.router, prefix="/stories", tags=["Stories"])
api_v1_router.include_router(events.router, prefix="/events", tags=["Events"])
