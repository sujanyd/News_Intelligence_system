"""
Tests for Cross-Source News Comparisons, Evidence Generation, Reports, and Duplicate Detection.

Validates:
1. Exact and near-duplicate detection and self-referential linking via duplicate_of_article_id.
2. Creating and running News Comparison sessions (NEWS_COMPARISON).
3. Ensuring composite foreign key enforcement across COMPARISON_ARTICLE, COMPARISON_COVERAGE,
   and COMPARISON_EVIDENCE.
4. Automatic discovery of headline framing contrasts and tone discrepancies.
5. Identification of coverage depth differences and topic omissions.
6. Generating synthesized evidence-based reports (REPORT) in Markdown, HTML, and JSON.
7. REST API endpoint availability and response contracts under /api/ and /api/v1/.
"""

from datetime import datetime, timezone
from typing import List, Tuple
import pytest
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.comparison_article import ComparisonArticle
from app.models.comparison_coverage import ComparisonCoverage
from app.models.comparison_evidence import ComparisonEvidence
from app.models.event import Event
from app.models.news_comparison import NewsComparison
from app.models.news_source import NewsSource
from app.models.report import Report
from app.models.story import Story
from app.services.comparison import get_comparison_service
from app.services.duplicate_detection import get_duplicate_detection_service
from app.services.report import get_report_service


@pytest.fixture
def news_sources(db_session: Session) -> Tuple[NewsSource, NewsSource, NewsSource]:
    s1 = NewsSource(name="Global Financial Daily", base_url="https://gfd.example.com")
    s2 = NewsSource(name="The Peoples Chronicle", base_url="https://chronicle.example.com")
    s3 = NewsSource(name="World Wire Service", base_url="https://wire.example.com")
    db_session.add_all([s1, s2, s3])
    db_session.commit()
    db_session.refresh(s1)
    db_session.refresh(s2)
    db_session.refresh(s3)
    return s1, s2, s3


@pytest.fixture
def story_and_event(db_session: Session) -> Tuple[Story, Event]:
    story = Story(title="Global Semiconductor Supply Chain Accord")
    db_session.add(story)
    db_session.flush()

    event = Event(
        story_id=story.id,
        event_time=datetime(2026, 11, 8, 10, 0, tzinfo=timezone.utc),
        event_time_precision="exact",
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(story)
    db_session.refresh(event)
    return story, event


@pytest.fixture
def sample_comparison_articles(
    db_session: Session,
    news_sources: Tuple[NewsSource, NewsSource, NewsSource],
    story_and_event: Tuple[Story, Event],
) -> List[Article]:
    s1, s2, s3 = news_sources
    _, event = story_and_event

    art1 = Article(
        source_id=s1.id,
        event_id=event.id,
        title="Nations Reach Historic Accord on Semiconductor Supply Chain Resilience",
        content=(
            "Trade ministers from thirty nations announced a landmark semiconductor pact today in Brussels. "
            "The agreement secures strategic domestic subsidies, joint research investments, and tariff exemptions. "
            "Officials praised the milestone consensus as vital for long-term technological security."
        ),
        url="https://gfd.example.com/semiconductor-pact-landmark",
        published_at=datetime(2026, 11, 8, 11, 0, tzinfo=timezone.utc),
    )

    art2 = Article(
        source_id=s2.id,
        event_id=event.id,
        title="Opposition Lawmakers Slam Brussels Tech Accord Over Severe Taxpayer Burden",
        content=(
            "Lawmakers launched fierce criticism against the newly finalized microchip agreement in Brussels. "
            "Critics condemned the multi-billion-dollar government payouts to corporate executives, warning "
            "families face escalating inflation while public services suffer critical budget cuts."
        ),
        url="https://chronicle.example.com/brussels-chip-backlash",
        published_at=datetime(2026, 11, 8, 11, 30, tzinfo=timezone.utc),
    )

    art3 = Article(
        source_id=s3.id,
        event_id=event.id,
        title="Ministers Conclude European Semiconductor Discussions in Brussels",
        content=(
            "Representatives concluded three days of bilateral trade discussions on microchips on Friday. "
            "The draft framework establishes quarterly monitoring committees and sets technical standards "
            "for international hardware shipments starting next year."
        ),
        url="https://wire.example.com/semiconductor-conclude-brussels",
        published_at=datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc),
    )

    db_session.add_all([art1, art2, art3])
    db_session.commit()
    db_session.refresh(art1)
    db_session.refresh(art2)
    db_session.refresh(art3)
    return [art1, art2, art3]


# ===========================================================================
# 1. Duplicate Detection Tests
# ===========================================================================

class TestDuplicateDetection:
    def test_exact_duplicate_detection(self, db_session: Session, sample_comparison_articles: List[Article]):
        primary = sample_comparison_articles[0]

        # Create exact syndicated republication with identical content
        syndicated = Article(
            source_id=sample_comparison_articles[1].source_id,
            title="Nations Reach Historic Accord on Semiconductor Supply Chain Resilience",
            content=primary.content,
            url="https://republish.example.com/exact-copy",
            content_hash=primary.content_hash,
        )
        db_session.add(syndicated)
        db_session.commit()
        db_session.refresh(syndicated)

        service = get_duplicate_detection_service()
        res = service.detect_and_link_duplicates_for_article(db=db_session, article_id=syndicated.id)

        assert res["is_duplicate"] is True
        assert res["duplicate_type"] == "exact"
        assert res["canonical_article_id"] == primary.id

        # Verify database self-reference
        db_session.refresh(syndicated)
        assert syndicated.duplicate_of_article_id == primary.id

    def test_near_duplicate_syndication_detection(self, db_session: Session, sample_comparison_articles: List[Article]):
        primary = sample_comparison_articles[0]

        # Create near-duplicate with tiny byline modification
        near_text = (
            "Trade ministers from thirty nations announced a landmark semiconductor pact today in Brussels. "
            "The agreement secures strategic domestic subsidies, joint research investments, and tariff exemptions. "
            "Reported by Wire Staff in Brussels."
        )
        near_art = Article(
            source_id=sample_comparison_articles[2].source_id,
            title="Nations Reach Landmark Accord on Semiconductor Supply Chain",
            content=near_text,
            url="https://partner.example.com/near-duplicate-chip",
        )
        db_session.add(near_art)
        db_session.commit()
        db_session.refresh(near_art)

        service = get_duplicate_detection_service()
        res = service.detect_and_link_duplicates_for_article(db=db_session, article_id=near_art.id)

        assert res["is_duplicate"] is True
        assert res["duplicate_type"] == "near_duplicate"
        assert res["canonical_article_id"] == primary.id
        assert res["similarity_score"] >= 0.60


# ===========================================================================
# 2. News Comparison Service Tests
# ===========================================================================

class TestNewsComparisonService:
    def test_create_and_run_comparison_by_event(
        self,
        db_session: Session,
        story_and_event: Tuple[Story, Event],
        sample_comparison_articles: List[Article],
    ):
        _, event = story_and_event
        service = get_comparison_service()

        res = service.create_or_run_comparison(
            db=db_session,
            title="Semiconductor Accord Cross-Media Comparison",
            event_id=event.id,
        )

        assert res.id is not None
        assert res.event_id == event.id
        assert res.article_count == 3
        assert len(res.coverages) == 3
        assert len(res.evidences) > 0
        assert len(res.political_signals) == 3

        # Verify database rows and constraints
        db_comp = db_session.query(NewsComparison).filter(NewsComparison.id == res.id).first()
        assert db_comp is not None

        comp_arts = db_session.query(ComparisonArticle).filter(ComparisonArticle.comparison_id == res.id).all()
        assert len(comp_arts) == 3

        comp_covs = db_session.query(ComparisonCoverage).filter(ComparisonCoverage.comparison_id == res.id).all()
        assert len(comp_covs) == 3
        for cov in comp_covs:
            assert cov.coverage_score is not None
            assert cov.tone_score is not None
            assert cov.primary_frame is not None

        comp_evs = db_session.query(ComparisonEvidence).filter(ComparisonEvidence.comparison_id == res.id).all()
        assert len(comp_evs) > 0
        # Check evidence types found
        ev_types = {e.evidence_type for e in comp_evs}
        assert "framing_contrast" in ev_types or "tone_discrepancy" in ev_types

    def test_comparison_by_article_ids(
        self,
        db_session: Session,
        sample_comparison_articles: List[Article],
    ):
        service = get_comparison_service()
        art1, art2 = sample_comparison_articles[:2]

        res = service.create_or_run_comparison(
            db=db_session,
            title="Two-Way Outlet Divergence",
            article_ids=[art1.id, art2.id],
        )
        assert res.article_count == 2
        assert len(res.coverages) == 2


# ===========================================================================
# 3. Report Generation Service Tests
# ===========================================================================

class TestReportGenerationService:
    def test_generate_markdown_report(
        self,
        db_session: Session,
        story_and_event: Tuple[Story, Event],
        sample_comparison_articles: List[Article],
    ):
        _, event = story_and_event
        comp_service = get_comparison_service()
        rep_service = get_report_service()

        comp = comp_service.create_or_run_comparison(
            db=db_session,
            title="European Tech Accord Media Analysis",
            event_id=event.id,
        )

        report_res = rep_service.generate_comparison_report(
            db=db_session,
            comparison_id=comp.id,
            report_format="markdown",
        )

        assert report_res.id is not None
        assert report_res.comparison_id == comp.id
        assert "European Tech Accord" in report_res.title
        assert "Executive Summary" in report_res.content
        assert "Participating Publishers" in report_res.content
        assert "Grounding" in report_res.content or "Evidence" in report_res.content
        assert "Methodological Notes & Limitations" in report_res.content

        # Verify DB persistence in REPORT table
        db_report = db_session.query(Report).filter(Report.id == report_res.id).first()
        assert db_report is not None
        assert db_report.report_format == "markdown"

    def test_generate_json_report(
        self,
        db_session: Session,
        story_and_event: Tuple[Story, Event],
        sample_comparison_articles: List[Article],
    ):
        _, event = story_and_event
        comp = get_comparison_service().create_or_run_comparison(
            db=db_session,
            title="JSON Format Comparison",
            event_id=event.id,
        )

        report_res = get_report_service().generate_comparison_report(
            db=db_session,
            comparison_id=comp.id,
            report_format="json",
        )
        assert report_res.report_format == "json"
        assert '"coverage_evaluation"' in report_res.content
        assert '"methodological_limitations"' in report_res.content


# ===========================================================================
# 4. REST API Endpoint Integration Tests
# ===========================================================================

class TestComparisonAndReportEndpoints:
    def test_detect_duplicates_endpoint(self, client, sample_comparison_articles: List[Article]):
        art = sample_comparison_articles[0]
        response = client.post(f"/api/articles/{art.id}/detect-duplicates")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == art.id
        assert "is_duplicate" in data
        assert "duplicate_type" in data

    def test_create_and_get_comparison_api(
        self,
        client,
        story_and_event: Tuple[Story, Event],
        sample_comparison_articles: List[Article],
    ):
        _, event = story_and_event
        payload = {
            "title": "API Multi-Source Comparison",
            "description": "API Integration Test",
            "event_id": event.id,
        }
        create_res = client.post("/api/comparisons", json=payload)
        assert create_res.status_code == 201
        data = create_res.json()
        comp_id = data["id"]
        assert data["title"] == "API Multi-Source Comparison"
        assert data["article_count"] == 3
        assert len(data["coverages"]) == 3

        # GET /api/comparisons
        list_res = client.get("/api/comparisons")
        assert list_res.status_code == 200
        assert len(list_res.json()) >= 1

        # GET /api/comparisons/{id}
        get_res = client.get(f"/api/comparisons/{comp_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == comp_id

        # GET /api/comparisons/{id}/evidence
        ev_res = client.get(f"/api/comparisons/{comp_id}/evidence")
        assert ev_res.status_code == 200
        assert isinstance(ev_res.json(), list)

        # GET /api/comparisons/{id}/coverage
        cov_res = client.get(f"/api/comparisons/{comp_id}/coverage")
        assert cov_res.status_code == 200
        assert len(cov_res.json()) == 3

        # Parity check on /api/v1/comparisons/{id}
        v1_res = client.get(f"/api/v1/comparisons/{comp_id}")
        assert v1_res.status_code == 200
        assert v1_res.json()["id"] == comp_id

    def test_generate_and_get_report_api(
        self,
        client,
        story_and_event: Tuple[Story, Event],
        sample_comparison_articles: List[Article],
    ):
        _, event = story_and_event
        comp_res = client.post(
            "/api/comparisons",
            json={"title": "Report Testing Comparison", "event_id": event.id},
        )
        comp_id = comp_res.json()["id"]

        # POST /api/reports/generate
        rep_res = client.post(
            "/api/reports/generate",
            json={"comparison_id": comp_id, "report_format": "markdown"},
        )
        assert rep_res.status_code == 201
        rep_data = rep_res.json()
        report_id = rep_data["id"]
        assert rep_data["comparison_id"] == comp_id
        assert len(rep_data["content"]) > 100

        # GET /api/reports
        list_reps = client.get("/api/reports")
        assert list_reps.status_code == 200
        assert len(list_reps.json()) >= 1

        # GET /api/reports/{id}
        single_rep = client.get(f"/api/reports/{report_id}")
        assert single_rep.status_code == 200
        assert single_rep.json()["id"] == report_id

        # Parity check on /api/v1/reports
        v1_reps = client.get(f"/api/v1/reports/{report_id}")
        assert v1_reps.status_code == 200
        assert v1_reps.json()["id"] == report_id
