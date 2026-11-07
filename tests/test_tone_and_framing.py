"""Tests for Tone and Framing Analysis endpoints and services."""

from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.models.analysis_framing_signal import AnalysisFramingSignal
from app.models.news_source import NewsSource
from app.services.tone_framing import ToneAndFramingAnalyzer, get_tone_framing_service


@pytest.fixture
def sample_news_source(db_session: Session) -> NewsSource:
    """Create a test source."""
    source = NewsSource(
        name="Global News Network",
        base_url="https://globalnews.example.com",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def sample_critical_article(db_session: Session, sample_news_source: NewsSource) -> Article:
    """Create a sample article with conflicting and critical text."""
    content = (
        "Opposition lawmakers have fiercely condemned the new administrative decree, blaming senior ministers "
        "for an escalating financial disaster. Families face severe economic distress as prices surge rapidly. "
        "The administration must act immediately to prevent severe financial collapse."
    )
    article = Article(
        source_id=sample_news_source.id,
        title="Opposition leaders slam government policy amid severe crisis and rising costs",
        content=content,
        url="https://globalnews.example.com/policy-crisis-test",
        published_at=datetime(2026, 11, 6, 10, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def sample_neutral_article(db_session: Session, sample_news_source: NewsSource) -> Article:
    """Create a factual neutral article."""
    content = (
        "The central statistical bureau announced third-quarter import and export figures on Monday. "
        "Exports stood at forty billion dollars while imports totaled thirty-eight billion dollars according "
        "to the official quarterly trade report."
    )
    article = Article(
        source_id=sample_news_source.id,
        title="Central statistics bureau releases quarterly trade data",
        content=content,
        url="https://globalnews.example.com/trade-data-test",
        published_at=datetime(2026, 11, 6, 11, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


# ==========================================
# Unit Tests for ToneAndFramingAnalyzer
# ==========================================

class TestToneAndFramingAnalyzer:
    def test_analyzer_tone_categories(self):
        analyzer = ToneAndFramingAnalyzer()

        # Alarming tone
        alarming_text = "Dangerous outbreak poses catastrophic risk and dire collapse across the entire region."
        res = analyzer.analyze_tone(alarming_text)
        assert res["tone"] == "alarming"
        assert res["tone_score"] < -0.3
        assert 0.0 <= res["confidence"] <= 1.0

        # Critical tone
        critical_text = "The committee strongly condemned the corrupt scheme and denounced executive misconduct."
        res = analyzer.analyze_tone(critical_text)
        assert res["tone"] == "critical"
        assert res["tone_score"] < 0.0

        # Positive / optimistic tone
        positive_text = "The team celebrated extraordinary success, outstanding achievements, and promising breakthroughs."
        res = analyzer.analyze_tone(positive_text)
        assert res["tone"] in ("positive", "optimistic")
        assert res["tone_score"] > 0.3

        # Neutral tone
        neutral_text = "The committee assembled at nine in the morning to discuss administrative procedures according to schedule."
        res = analyzer.analyze_tone(neutral_text)
        assert res["tone"] == "neutral"
        assert -0.25 <= res["tone_score"] <= 0.25

    def test_analyzer_headline_framing(self):
        analyzer = ToneAndFramingAnalyzer()

        # Blame attribution
        blame_res = analyzer.analyze_headline_framing("Lawmakers blame prime minister for devastating policy failure")
        assert blame_res["primary_frame"] == "blame_attribution"
        assert len(blame_res["evidence_phrases"]) > 0

        # Urgency
        urgency_res = analyzer.analyze_headline_framing("Emergency alert issued as critical deadline requires immediate action")
        assert urgency_res["primary_frame"] == "urgency"

        # Conflict emphasis
        conflict_res = analyzer.analyze_headline_framing("Ministers clash violently over contested parliamentary dispute")
        assert conflict_res["primary_frame"] == "conflict_emphasis"

        # Neutral reporting
        neutral_res = analyzer.analyze_headline_framing("Municipal council reviews weekly road maintenance schedule")
        assert neutral_res["primary_frame"] == "neutral_reporting"

    def test_analyzer_framing_signals_offsets(self):
        analyzer = ToneAndFramingAnalyzer()
        text = "The administration must act immediately to prevent severe financial collapse. Families face devastating losses."
        signals = analyzer.extract_framing_signals(text)

        assert len(signals) > 0
        for sig in signals:
            assert sig["frame_type"] in (
                "conflict_emphasis", "blame_attribution", "urgency",
                "economic_consequence", "emotional_language", "achievement_progress",
                "cooperative_progress"
            )
            assert 0.0 <= sig["intensity_score"] <= 1.0
            assert sig["evidence_text"]
            # Offsets validity
            start = sig["start_char"]
            end = sig["end_char"]
            assert start is not None and end is not None
            assert 0 <= start < end <= len(text)
            assert text[start:end] == sig["evidence_text"]


# ==========================================
# Service & Database Tests
# ==========================================

class TestToneAndFramingService:
    def test_service_analyze_and_store(self, db_session: Session, sample_critical_article: Article):
        service = get_tone_framing_service()
        result = service.analyze_and_store_tone_and_framing(
            db=db_session,
            article_id=sample_critical_article.id,
            force_reanalyze=True,
        )

        assert result.article_id == sample_critical_article.id
        assert result.tone.tone in ("critical", "alarming", "negative")
        assert result.headline_framing.primary_frame in ("blame_attribution", "conflict_emphasis", "urgency", "economic_consequence")
        assert len(result.framing_signals) > 0

        # Verify database persistence
        analysis = db_session.query(ArticleAnalysis).filter(ArticleAnalysis.article_id == sample_critical_article.id).first()
        assert analysis is not None
        assert analysis.sentiment_label == result.tone.tone
        assert analysis.sentiment_score == result.tone.tone_score
        assert analysis.confidence_score == result.tone.confidence

        stored_signals = db_session.query(AnalysisFramingSignal).filter(AnalysisFramingSignal.analysis_id == analysis.id).all()
        assert len(stored_signals) == len(result.framing_signals)
        full_article_text = f"{sample_critical_article.title} {sample_critical_article.content}"
        for st_sig in stored_signals:
            assert st_sig.start_char <= st_sig.end_char
            assert st_sig.evidence_text in full_article_text


# ==========================================
# API Route Integration Tests
# ==========================================

class TestToneAndFramingEndpoints:
    def test_get_tone_framing_full(self, client, sample_critical_article: Article):
        response = client.get(f"/api/articles/{sample_critical_article.id}/tone-framing")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_critical_article.id
        assert "tone" in data
        assert "headline_framing" in data
        assert "framing_signals" in data
        assert len(data["framing_signals"]) > 0

    def test_post_force_reanalyze(self, client, sample_critical_article: Article):
        response = client.post(
            f"/api/articles/{sample_critical_article.id}/tone-framing/analyze",
            json={"force_reanalyze": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_critical_article.id
        assert data["tone"]["tone"] is not None

    def test_get_tone_endpoint(self, client, sample_critical_article: Article):
        response = client.get(f"/api/articles/{sample_critical_article.id}/tone")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_critical_article.id
        assert data["tone"] in ("critical", "alarming", "negative", "neutral", "positive", "optimistic")
        assert "tone_score" in data
        assert "confidence" in data
        assert "explanation" in data

    def test_get_headline_framing_endpoint(self, client, sample_critical_article: Article):
        response = client.get(f"/api/articles/{sample_critical_article.id}/headline-framing")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_critical_article.id
        assert data["headline"] == sample_critical_article.title
        assert "primary_frame" in data
        assert isinstance(data["evidence_phrases"], list)
        assert "explanation" in data

    def test_get_framing_signals_endpoint(self, client, sample_critical_article: Article):
        response = client.get(f"/api/articles/{sample_critical_article.id}/framing-signals")
        assert response.status_code == 200
        signals = response.json()
        assert isinstance(signals, list)
        assert len(signals) > 0
        first = signals[0]
        assert "frame_type" in first
        assert "intensity_score" in first
        assert "evidence_text" in first
        assert "start_char" in first
        assert "end_char" in first

    def test_tone_framing_not_found(self, client):
        response = client.get("/api/articles/999999/tone-framing")
        assert response.status_code == 404
        assert "999999" in response.json()["detail"]

    def test_neutral_article_classification(self, client, sample_neutral_article: Article):
        response = client.get(f"/api/articles/{sample_neutral_article.id}/tone-framing")
        assert response.status_code == 200
        data = response.json()
        assert data["tone"]["tone"] == "neutral"
        assert data["headline_framing"]["primary_frame"] == "neutral_reporting"
