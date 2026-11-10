"""
Tests for AI-Generated News Text Detection.

Validates:
1. Probabilistic estimation of machine-generated text (0.0 to 1.0).
2. Burstiness variance and lexical uniformity calculations.
3. Distinguishing human journalism (high sentence variance) from uniform synthetic writing.
4. Database persistence in `AI_DETECTION_RESULT` (`ai_detection_results`).
5. Flagging for editorial review when likelihood exceeds threshold (`is_flagged_for_review`).
6. REST API endpoints:
   - GET /api/articles/{id}/ai-detection
   - POST /api/articles/{id}/ai-detection/analyze
   - GET /api/articles/ai-detection/flagged
7. Parity under /api/ and /api/v1/.
"""

from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.ai_detection_result import AIDetectionResult
from app.models.article import Article
from app.models.news_source import NewsSource
from app.services.ai_detection import (
    AIDetectionEngine,
    get_ai_detection_service,
)


@pytest.fixture
def sample_source(db_session: Session) -> NewsSource:
    source = NewsSource(name="Tech Dispatch", base_url="https://techdispatch.example.com")
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def human_journalism_article(db_session: Session, sample_source: NewsSource) -> Article:
    """
    Realistic human news article with natural variance in sentence lengths,
    varying from 4 words to 35 words.
    """
    content = (
        "Markets plummeted today. Following hours of contentious testimony before the Senate banking committee, "
        "investors grew visibly anxious over regulatory headwinds. The chairman was blunt: interest rates will stay higher "
        "for considerably longer than Wall Street had projected. That sent shockwaves. Tech stocks suffered their steepest "
        "single-session losses in over eighteen months as trading volumes surged uncontrollably into the closing bell."
    )
    article = Article(
        source_id=sample_source.id,
        title="Markets Plummet Following Testy Senate Hearing",
        content=content,
        url="https://techdispatch.example.com/markets-drop-hearing",
        published_at=datetime(2026, 11, 9, 14, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def formulaic_ai_article(db_session: Session, sample_source: NewsSource) -> Article:
    """
    Formulaic article with uniform sentence length, consistent syntax, and low burstiness.
    """
    content = (
        "The economic committee convened today to review the quarterly financial developments. "
        "Several notable economists presented their comprehensive assessments to the attending members. "
        "The initial reports indicated that inflation continued to moderate across multiple major sectors. "
        "Consumer spending maintained steady momentum throughout the previous three calendar months. "
        "Supply chain disruptions gradually resolved according to the preliminary documentation provided."
    )
    article = Article(
        source_id=sample_source.id,
        title="Economic Committee Convenes to Review Quarterly Financial Developments",
        content=content,
        url="https://techdispatch.example.com/economic-committee-convenes",
        published_at=datetime(2026, 11, 9, 15, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


# ===========================================================================
# 1. Unit Tests for AIDetectionEngine
# ===========================================================================

class TestAIDetectionEngine:
    def test_insufficient_text_handled_safely(self):
        engine = AIDetectionEngine()
        res = engine.analyze_text("Too short.")
        assert res["ai_likelihood"] <= 0.10
        assert res["confidence_score"] <= 0.60
        assert "Insufficient" in res["interpretation"]

    def test_burstiness_differentiation(self, human_journalism_article: Article, formulaic_ai_article: Article):
        engine = AIDetectionEngine()
        human_res = engine.analyze_text(human_journalism_article.content)
        ai_res = engine.analyze_text(formulaic_ai_article.content)

        # Human article with high variance in sentence length should have higher burstiness
        assert human_res["metrics"]["burstiness_score"] > ai_res["metrics"]["burstiness_score"]
        # Formulaic uniform text should have higher estimated likelihood
        assert ai_res["ai_likelihood"] >= human_res["ai_likelihood"]

    def test_likelihood_bounds_and_metrics(self, human_journalism_article: Article):
        engine = AIDetectionEngine()
        res = engine.analyze_text(human_journalism_article.content)

        assert 0.0 <= res["ai_likelihood"] <= 1.0
        assert 0.0 <= res["confidence_score"] <= 1.0
        metrics = res["metrics"]
        assert "burstiness_score" in metrics
        assert "lexical_uniformity" in metrics
        assert metrics["sentence_count"] >= 3


# ===========================================================================
# 2. Database Service Integration Tests
# ===========================================================================

class TestAIDetectionService:
    def test_analyze_and_store_article(self, db_session: Session, human_journalism_article: Article):
        service = get_ai_detection_service()
        response = service.analyze_and_store_article(
            db=db_session,
            article_id=human_journalism_article.id,
            force_reanalyze=True,
        )

        assert response.article_id == human_journalism_article.id
        assert 0.0 <= response.ai_likelihood <= 1.0
        assert response.model_name == "statistical-burstiness-entropy-v1"
        assert response.metrics is not None
        assert "burstiness_score" in response.analysis_details

        # Verify DB persistence in AI_DETECTION_RESULT table
        record = (
            db_session.query(AIDetectionResult)
            .filter(AIDetectionResult.article_id == human_journalism_article.id)
            .first()
        )
        assert record is not None
        assert record.ai_likelihood == response.ai_likelihood
        assert record.model_name == response.model_name

    def test_editorial_review_flagging(self, db_session: Session, formulaic_ai_article: Article):
        service = get_ai_detection_service()
        # Set low flag threshold to verify flagging logic
        response = service.analyze_and_store_article(
            db=db_session,
            article_id=formulaic_ai_article.id,
            force_reanalyze=True,
            flag_threshold=0.30,
        )

        assert response.is_flagged_for_review is True
        record = db_session.query(AIDetectionResult).filter(AIDetectionResult.id == response.id).first()
        assert record.is_flagged_for_review is True

    def test_idempotent_cached_result(self, db_session: Session, human_journalism_article: Article):
        service = get_ai_detection_service()
        first = service.analyze_and_store_article(db=db_session, article_id=human_journalism_article.id)
        second = service.get_article_ai_detection(db=db_session, article_id=human_journalism_article.id)

        assert first.id == second.id
        assert first.ai_likelihood == second.ai_likelihood


# ===========================================================================
# 3. REST API Endpoint Integration Tests
# ===========================================================================

class TestAIDetectionEndpoints:
    def test_get_ai_detection_endpoint(self, client, human_journalism_article: Article):
        response = client.get(f"/api/articles/{human_journalism_article.id}/ai-detection")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == human_journalism_article.id
        assert "ai_likelihood" in data
        assert "confidence_score" in data
        assert "model_name" in data
        assert "interpretation" in data
        assert "limitations" in data

    def test_post_analyze_ai_detection_endpoint(self, client, formulaic_ai_article: Article):
        response = client.post(
            f"/api/articles/{formulaic_ai_article.id}/ai-detection/analyze",
            json={"force_reanalyze": True, "flag_threshold": 0.35},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == formulaic_ai_article.id
        assert data["is_flagged_for_review"] is True

    def test_list_flagged_articles_endpoint(self, client, formulaic_ai_article: Article):
        # Trigger with low threshold to ensure flagged row exists
        client.post(
            f"/api/articles/{formulaic_ai_article.id}/ai-detection/analyze",
            json={"force_reanalyze": True, "flag_threshold": 0.20},
        )

        response = client.get("/api/articles/ai-detection/flagged")
        assert response.status_code == 200
        flagged_list = response.json()
        assert isinstance(flagged_list, list)
        assert len(flagged_list) >= 1
        assert any(item["article_id"] == formulaic_ai_article.id for item in flagged_list)

    def test_api_v1_parity(self, client, human_journalism_article: Article):
        v1_res = client.get(f"/api/v1/articles/{human_journalism_article.id}/ai-detection")
        assert v1_res.status_code == 200
        assert v1_res.json()["article_id"] == human_journalism_article.id

    def test_article_not_found(self, client):
        response = client.get("/api/articles/999999/ai-detection")
        assert response.status_code == 404
        assert "999999" in response.json()["detail"]
