"""
Dashboard summary API endpoint.
Returns aggregated platform metrics for the unified frontend dashboard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.article import Article
from app.models.news_source import NewsSource
from app.models.story import Story
from app.models.event import Event
from app.models.news_comparison import NewsComparison
from app.models.report import Report
from app.models.ai_detection_result import AIDetectionResult
from app.schemas.dashboard import DashboardSummaryResponse

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Returns system-wide aggregated metrics in a single lightweight call.
    """
    total_articles = db.query(Article).count()
    total_sources = db.query(NewsSource).count()
    total_stories = db.query(Story).count()
    total_events = db.query(Event).count()
    total_comparisons = db.query(NewsComparison).count()
    total_reports = db.query(Report).count()
    total_flagged_ai = (
        db.query(AIDetectionResult)
        .filter(AIDetectionResult.is_flagged_for_review == True)
        .count()
    )

    qdrant_mode = "in-memory (:memory:)" if settings.QDRANT_URL == ":memory:" else settings.QDRANT_URL

    return DashboardSummaryResponse(
        total_articles=total_articles,
        total_sources=total_sources,
        total_stories=total_stories,
        total_events=total_events,
        total_comparisons=total_comparisons,
        total_reports=total_reports,
        total_flagged_ai_articles=total_flagged_ai,
        embedding_provider=settings.EMBEDDING_PROVIDER,
        embedding_dimension=settings.EMBEDDING_DIMENSIONS,
        qdrant_mode=qdrant_mode,
    )
