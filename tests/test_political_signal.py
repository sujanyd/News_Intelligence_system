"""
Tests for Political and Party-Leaning Signal Analysis.

Validates:
1. Political entity identification (political parties, politicians, governmental/political organizations).
2. Reuse of existing canonical ENTITY records across multiple extraction runs.
3. Political presentation signal detection (favorable, unfavorable, neutral, mixed).
4. Slant score (-1.0 to +1.0) and partisanship score (0.0 to 1.0) computation.
5. Storage and linking in ARTICLE_ANALYSIS (bias_score, bias_label), ENTITY, and ANALYSIS_ENTITY.
6. Persistence in COMPARISON_POLITICAL_SIGNAL within a NewsComparison session.
7. REST API endpoints for:
   - GET /api/articles/{id}/political-signals
   - POST /api/articles/{id}/political-signals/analyze
   - GET /api/articles/{id}/political-entities
   - GET /api/articles/{id}/political-evidence
   - GET /api/comparisons/{id}/political-signals
"""

from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.analysis_entity import AnalysisEntity
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.models.comparison_article import ComparisonArticle
from app.models.comparison_political_signal import ComparisonPoliticalSignal
from app.models.entity import Entity
from app.models.news_comparison import NewsComparison
from app.models.news_source import NewsSource
from app.services.political_signal import (
    PoliticalSignalAnalyzer,
    get_political_signal_service,
)


@pytest.fixture
def sample_source(db_session: Session) -> NewsSource:
    """Create a sample news source."""
    source = NewsSource(
        name="The Daily Chronicler",
        base_url="https://chronicler.example.com",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def sample_source_b(db_session: Session) -> NewsSource:
    """Create a second news source for comparison."""
    source = NewsSource(
        name="The National Reviewer",
        base_url="https://reviewer.example.com",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def political_favorable_article(db_session: Session, sample_source: NewsSource) -> Article:
    """Article with favorable presentation of Democrats / Joe Biden."""
    content = (
        "The Democratic Party celebrated a historic achievement today in Washington as President Joe Biden "
        "championed a landmark reform package. Lawmakers widely hailed the decisive action as an effective policy "
        "with broad support across the United States Congress."
    )
    article = Article(
        source_id=sample_source.id,
        title="President Biden Championed Landmark Reform with Broad Support",
        content=content,
        url="https://chronicler.example.com/biden-reform-success",
        published_at=datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def political_critical_article(db_session: Session, sample_source_b: NewsSource) -> Article:
    """Article with critical/unfavorable presentation of Democrats / Joe Biden."""
    content = (
        "Opposition leaders slammed the Democratic Party today, arguing President Joe Biden presided over "
        "a catastrophic failure. The administration is embroiled in controversy and facing severe backlash "
        "over flawed leadership and broken promises in Congress."
    )
    article = Article(
        source_id=sample_source_b.id,
        title="Opposition Slammed Democratic Party Over Catastrophic Failure",
        content=content,
        url="https://reviewer.example.com/biden-policy-backlash",
        published_at=datetime(2026, 11, 7, 13, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def neutral_political_article(db_session: Session, sample_source: NewsSource) -> Article:
    """Article reporting political votes objectively without emotive praise or blame cues."""
    content = (
        "Members of the United States Congress assembled on Thursday afternoon. "
        "The House of Representatives held a procedural roll call on the federal appropriations schedule, "
        "with both Republican and Democratic members present on the floor."
    )
    article = Article(
        source_id=sample_source.id,
        title="Congress Holds Procedural Roll Call on Appropriations",
        content=content,
        url="https://chronicler.example.com/congress-roll-call",
        published_at=datetime(2026, 11, 7, 14, 0, tzinfo=timezone.utc),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def sample_comparison(
    db_session: Session,
    political_favorable_article: Article,
    political_critical_article: Article,
) -> NewsComparison:
    """Create a sample NewsComparison with two opposing articles."""
    comparison = NewsComparison(
        title="Media Coverage Comparison of Congressional Reform",
        description="Cross-outlet comparative analysis of policy reform coverage",
        status="completed",
    )
    db_session.add(comparison)
    db_session.flush()

    ca1 = ComparisonArticle(comparison_id=comparison.id, article_id=political_favorable_article.id)
    ca2 = ComparisonArticle(comparison_id=comparison.id, article_id=political_critical_article.id)
    db_session.add_all([ca1, ca2])
    db_session.commit()
    db_session.refresh(comparison)
    return comparison


# ===========================================================================
# 1. Unit Tests for PoliticalSignalAnalyzer
# ===========================================================================

class TestPoliticalSignalAnalyzer:
    def test_identify_political_parties(self):
        analyzer = PoliticalSignalAnalyzer()
        text = "The Democratic Party and the Republican Party clashed over the budget in the Senate."
        entities = analyzer.identify_political_entities(text)

        names = {e["name"] for e in entities}
        assert "Democratic Party" in names
        assert "Republican Party" in names
        assert "United States Senate" in names

        # Verify classifications
        party_ents = [e for e in entities if e["political_category"] == "POLITICAL_PARTY"]
        assert len(party_ents) >= 2

    def test_identify_politicians_and_titles(self):
        analyzer = PoliticalSignalAnalyzer()
        text = "President Joe Biden announced new appointments while Senator Chuck Schumer spoke to reporters."
        entities = analyzer.identify_political_entities(text)

        names = {e["name"] for e in entities}
        assert "Joe Biden" in names
        assert "Chuck Schumer" in names

        biden_ent = next(e for e in entities if e["name"] == "Joe Biden")
        assert biden_ent["political_category"] == "POLITICIAN"
        assert biden_ent["entity_type"] == "PERSON"
        assert biden_ent["ideological_affiliation"] == "Democratic Party"

    def test_favorable_presentation_signals(self):
        analyzer = PoliticalSignalAnalyzer()
        text = "Supporters praised President Joe Biden for delivering a historic achievement and decisive action."
        entities = analyzer.identify_political_entities(text)
        signals, metrics = analyzer.analyze_political_presentation(text, entities)

        assert len(signals) > 0
        biden_signals = [s for s in signals if s.entity_name == "Joe Biden"]
        assert len(biden_signals) > 0
        assert biden_signals[0].treatment == "favorable"
        assert "praise" in biden_signals[0].framing_technique or "achievement" in biden_signals[0].framing_technique

    def test_unfavorable_presentation_signals(self):
        analyzer = PoliticalSignalAnalyzer()
        text = "Critics slammed the Democratic Party for a catastrophic failure and flawed leadership."
        entities = analyzer.identify_political_entities(text)
        signals, metrics = analyzer.analyze_political_presentation(text, entities)

        assert len(signals) > 0
        dem_signals = [s for s in signals if s.entity_name == "Democratic Party"]
        assert len(dem_signals) > 0
        assert dem_signals[0].treatment == "unfavorable"

    def test_neutral_presentation(self):
        analyzer = PoliticalSignalAnalyzer()
        text = "The House of Representatives met at 10 a.m. to review routine committee documentation."
        entities = analyzer.identify_political_entities(text)
        signals, metrics = analyzer.analyze_political_presentation(text, entities)

        assert len(signals) == 0
        assert metrics["political_leaning"] == "center"
        assert metrics["slant_score"] == 0.0
        assert metrics["partisanship_score"] < 0.2


# ===========================================================================
# 2. Database Service Integration Tests
# ===========================================================================

class TestPoliticalSignalService:
    def test_analyze_and_store_article_political_signals(
        self,
        db_session: Session,
        political_favorable_article: Article,
    ):
        service = get_political_signal_service()
        res = service.analyze_and_store_article_political_signals(
            db=db_session,
            article_id=political_favorable_article.id,
            force_reanalyze=True,
        )

        assert res.article_id == political_favorable_article.id
        assert len(res.political_entities) > 0
        assert len(res.signals) > 0
        assert res.political_leaning in ("left", "center-left", "center")

        # Verify database persistence in ARTICLE_ANALYSIS
        analysis = (
            db_session.query(ArticleAnalysis)
            .filter(ArticleAnalysis.article_id == political_favorable_article.id)
            .first()
        )
        assert analysis is not None
        assert analysis.bias_label == res.political_leaning
        assert analysis.bias_score == res.slant_score

        # Verify entity reuse in ENTITY
        stored_entities = db_session.query(Entity).all()
        assert len(stored_entities) > 0
        entity_names = {e.name for e in stored_entities}
        assert "Democratic Party" in entity_names or "Joe Biden" in entity_names

        # Verify linking in ANALYSIS_ENTITY
        analysis_entities = (
            db_session.query(AnalysisEntity)
            .filter(AnalysisEntity.analysis_id == analysis.id)
            .all()
        )
        assert len(analysis_entities) > 0

    def test_entity_deduplication_and_reuse(
        self,
        db_session: Session,
        political_favorable_article: Article,
        political_critical_article: Article,
    ):
        service = get_political_signal_service()

        # Run first article
        service.analyze_and_store_article_political_signals(
            db=db_session,
            article_id=political_favorable_article.id,
            force_reanalyze=True,
        )
        entity_count_1 = db_session.query(Entity).filter(Entity.name == "Democratic Party").count()
        assert entity_count_1 == 1

        # Run second article that also mentions Democratic Party
        service.analyze_and_store_article_political_signals(
            db=db_session,
            article_id=political_critical_article.id,
            force_reanalyze=True,
        )
        entity_count_2 = db_session.query(Entity).filter(Entity.name == "Democratic Party").count()
        assert entity_count_2 == 1  # Did not create a duplicate row!

    def test_comparison_political_signals_persistence(
        self,
        db_session: Session,
        sample_comparison: NewsComparison,
    ):
        service = get_political_signal_service()
        coverage_res = service.get_comparison_political_coverage(
            db=db_session,
            comparison_id=sample_comparison.id,
        )

        assert coverage_res.comparison_id == sample_comparison.id
        assert coverage_res.article_count == 2
        assert len(coverage_res.signals) == 2

        # Verify COMPARISON_POLITICAL_SIGNAL table records
        records = (
            db_session.query(ComparisonPoliticalSignal)
            .filter(ComparisonPoliticalSignal.comparison_id == sample_comparison.id)
            .all()
        )
        assert len(records) == 2
        for r in records:
            assert r.political_leaning in ("left", "center-left", "center", "center-right", "right")
            assert r.slant_score is not None
            assert r.signal_description is not None


# ===========================================================================
# 3. REST API Endpoint Tests
# ===========================================================================

class TestPoliticalSignalEndpoints:
    def test_get_article_political_signals(self, client, political_favorable_article: Article):
        response = client.get(f"/api/articles/{political_favorable_article.id}/political-signals")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == political_favorable_article.id
        assert "political_leaning" in data
        assert "slant_score" in data
        assert "partisanship_score" in data
        assert "political_entities" in data
        assert "signals" in data
        assert len(data["political_entities"]) > 0

    def test_post_analyze_article_political_signals(self, client, political_critical_article: Article):
        response = client.post(
            f"/api/articles/{political_critical_article.id}/political-signals/analyze",
            json={"force_reanalyze": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == political_critical_article.id
        assert "political_leaning" in data

    def test_get_article_political_entities(self, client, political_favorable_article: Article):
        response = client.get(f"/api/articles/{political_favorable_article.id}/political-entities")
        assert response.status_code == 200
        entities = response.json()
        assert isinstance(entities, list)
        assert len(entities) > 0
        names = {e["name"] for e in entities}
        assert "Democratic Party" in names or "Joe Biden" in names

    def test_get_article_political_evidence(self, client, political_critical_article: Article):
        response = client.get(f"/api/articles/{political_critical_article.id}/political-evidence")
        assert response.status_code == 200
        evidence = response.json()
        assert isinstance(evidence, list)
        assert len(evidence) > 0
        first = evidence[0]
        assert "entity_name" in first
        assert "treatment" in first
        assert "evidence_text" in first
        assert "start_char" in first
        assert "end_char" in first

    def test_get_comparison_political_signals(self, client, sample_comparison: NewsComparison):
        response = client.get(f"/api/comparisons/{sample_comparison.id}/political-signals")
        assert response.status_code == 200
        data = response.json()
        assert data["comparison_id"] == sample_comparison.id
        assert data["article_count"] == 2
        assert len(data["signals"]) == 2
        assert "diversity_summary" in data

    def test_article_not_found(self, client):
        response = client.get("/api/articles/999999/political-signals")
        assert response.status_code == 404
        assert "999999" in response.json()["detail"]

    def test_comparison_not_found(self, client):
        response = client.get("/api/comparisons/999999/political-signals")
        assert response.status_code == 404
        assert "999999" in response.json()["detail"]

    def test_neutral_political_article_api(self, client, neutral_political_article: Article):
        response = client.get(f"/api/articles/{neutral_political_article.id}/political-signals")
        assert response.status_code == 200
        data = response.json()
        assert data["political_leaning"] == "center"
        assert abs(data["slant_score"]) < 0.2
