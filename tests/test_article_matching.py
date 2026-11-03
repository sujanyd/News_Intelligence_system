"""
Tests for Article Pair Matching and Classification Service.

Covers:
1. Two articles reporting the SAME event.
2. Two articles reporting RELATED developments (same overarching topic or story, but different events/stages).
3. Two articles discussing DIFFERENT events/subjects.
4. Articles with completely different headlines about the same event (different publisher phrasing).
5. Incomplete/headline-only articles.
6. Canonical ordering enforcement (article_id_1 < article_id_2).
7. Duplicate match prevention upon repeated runs.
8. Error handling for non-existent article IDs.
9. Classification confidence handling.
10. API endpoints:
    - POST /api/articles/{article_id}/match
    - GET /api/articles/{article_id}/matches
    - GET /api/matches/{match_id}
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
import pytest
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_match import ArticleMatch
from app.models.event import Event
from app.models.news_source import NewsSource
from app.models.story import Story
from app.services.embedding import (
    MockEmbeddingProvider,
    generate_article_embedding,
    run_article_embedding_generation,
)
from app.services.matching import (
    ArticleMatchingService,
    compute_entity_overlap,
    extract_salient_entities,
    get_matching_service,
)
from app.services.vector_db import get_vector_db_service


@pytest.fixture
def sources(db_session: Session) -> Tuple[NewsSource, NewsSource]:
    s1 = NewsSource(name="Reuters", base_url="https://www.reuters.com")
    s2 = NewsSource(name="Associated Press", base_url="https://apnews.com")
    db_session.add_all([s1, s2])
    db_session.commit()
    db_session.refresh(s1)
    db_session.refresh(s2)
    return s1, s2


@pytest.fixture
def labeled_test_articles(db_session: Session, sources) -> Dict[str, Article]:
    """
    Manually constructed test dataset covering distinct real-world news categories.
    """
    s1, s2 = sources
    now = datetime.now(timezone.utc)

    # Overarching economic story
    story = Story(title="Global Monetary Policy Adjustments 2026")
    db_session.add(story)
    db_session.flush()

    # Specific interest rate event
    rate_event = Event(
        story_id=story.id,
        event_time=now,
        event_time_precision="exact",
    )
    # Different event under same story (employment report)
    jobs_event = Event(
        story_id=story.id,
        event_time=now - timedelta(days=2),
        event_time_precision="date",
    )
    db_session.add_all([rate_event, jobs_event])
    db_session.flush()

    # Pair 1 (SAME event, different publishers & different phrasing):
    # Reuters reporting Fed rate cut
    art_same_1 = Article(
        source_id=s1.id,
        event_id=rate_event.id,
        title="Federal Reserve Cuts Benchmark Rates by 25 Basis Points",
        content="The Federal Reserve announced a quarter-point rate reduction following the FOMC meeting in Washington.",
        url="https://www.reuters.com/markets/rates/fed-cut-2026",
        published_at=now,
        content_availability="full_text",
    )
    # AP reporting Fed rate cut with different headline
    art_same_2 = Article(
        source_id=s2.id,
        event_id=rate_event.id,
        title="US Central Bank Lowers Borrowing Costs as Inflation Cools",
        content="Chairman Powell and the Federal Reserve lowered interest rates today amid easing consumer price pressures.",
        url="https://apnews.com/economy/fed-reduces-costs",
        published_at=now + timedelta(hours=2),
        content_availability="full_text",
    )

    # Pair 2 (RELATED: same economic story/topic, but different event/topic - Jobs report)
    art_related = Article(
        source_id=s1.id,
        event_id=jobs_event.id,
        title="US Job Growth Moderates in October as Hiring Slows Down",
        content="Labor Department data showed steady job additions, reinforcing expectations of further Federal Reserve easing.",
        url="https://www.reuters.com/economy/us-jobs-october",
        published_at=now - timedelta(days=2),
        content_availability="full_text",
    )

    # Pair 3 (DIFFERENT: Space exploration, unrelated domain and different entities)
    art_different = Article(
        source_id=s2.id,
        event_id=None,
        title="NASA James Webb Telescope Identifies Water Vapor on Distant Exoplanet",
        content="Astronomers detected atmospheric chemical signatures on exoplanet K2-18b using spectroscopic observations.",
        url="https://apnews.com/science/nasa-webb-water-vapor",
        published_at=now,
        content_availability="full_text",
    )

    # Incomplete / Headline-only article
    art_headline_only = Article(
        source_id=s1.id,
        event_id=rate_event.id,
        title="Federal Reserve Rate Decision Announced",
        content=None,
        url="https://www.reuters.com/flash/fed-rate-decision",
        published_at=now + timedelta(minutes=15),
        content_availability="headline_only",
    )

    articles = {
        "same_1": art_same_1,
        "same_2": art_same_2,
        "related": art_related,
        "different": art_different,
        "headline_only": art_headline_only,
    }

    for art in articles.values():
        db_session.add(art)
    db_session.commit()
    for art in articles.values():
        db_session.refresh(art)

    return articles


class TestEntityExtractionAndSignals:
    """Tests named entity extraction and similarity heuristics."""

    def test_extract_salient_entities(self):
        text = "Federal Reserve Chairman Jerome Powell met with European Central Bank officials in Washington."
        entities = extract_salient_entities(text)
        assert "federal reserve" in entities
        assert "jerome powell" in entities
        assert "european central bank" in entities

    def test_entity_overlap_identical_and_disjoint(self):
        set_a = {"federal reserve", "washington", "inflation"}
        set_b = {"federal reserve", "washington", "interest rates"}
        score, shared = compute_entity_overlap(set_a, set_b)
        assert score > 0.4
        assert "federal reserve" in shared
        assert "washington" in shared

        # Disjoint
        set_c = {"nasa", "mars", "rover"}
        score_c, shared_c = compute_entity_overlap(set_a, set_c)
        assert score_c == 0.0
        assert shared_c == []


class TestPairwiseClassificationLogic:
    """Tests the classification service for SAME, RELATED, and DIFFERENT pairs."""

    def test_classify_same_event_shared_event_id(self, db_session: Session, labeled_test_articles):
        """Articles sharing an event ID are classified as SAME with high confidence."""
        matching_svc = get_matching_service()
        art1 = labeled_test_articles["same_1"]
        art2 = labeled_test_articles["same_2"]

        label, sim_score, conf_score, sigs = matching_svc.classify_article_pair(
            article_1=art1,
            article_2=art2,
            headline_sim=0.88,
        )

        assert label == "SAME"
        assert conf_score >= 0.90
        assert sigs.event_id_match is True

    def test_classify_same_event_different_headlines(self, db_session: Session, labeled_test_articles):
        """Articles with different headlines but strong entity overlap and close timestamps are classified as SAME."""
        matching_svc = get_matching_service()
        art1 = Article(
            source_id=1,
            title="President Signs Historic Clean Energy Infrastructure Bill",
            content="The White House announced the enactment of major climate investments today in Washington.",
            url="https://news1.org/climate-bill",
            published_at=datetime.now(timezone.utc),
            content_availability="full_text",
        )
        art2 = Article(
            source_id=2,
            title="Congress Passes Landmark Climate and Clean Energy Legislation",
            content="Lawmakers delivered the clean energy package to the White House following a decisive vote in Washington.",
            url="https://news2.org/energy-vote",
            published_at=datetime.now(timezone.utc),
            content_availability="full_text",
        )
        db_session.add_all([art1, art2])
        db_session.commit()

        # Headline similarity is moderate (e.g. 0.84), entity overlap exists
        label, sim_score, conf_score, sigs = matching_svc.classify_article_pair(
            article_1=art1,
            article_2=art2,
            headline_sim=0.85,
        )

        assert label == "SAME"
        assert conf_score > 0.70

    def test_classify_related_developments(self, db_session: Session, labeled_test_articles):
        """Articles in the same economic story or moderate similarity are classified as RELATED."""
        matching_svc = get_matching_service()
        art1 = labeled_test_articles["same_1"]  # Fed rate cut
        art_rel = labeled_test_articles["related"]  # Jobs report

        label, sim_score, conf_score, sigs = matching_svc.classify_article_pair(
            article_1=art1,
            article_2=art_rel,
            headline_sim=0.58,
        )

        assert label == "RELATED"
        assert sigs.same_story_id is True

    def test_classify_different_subjects(self, db_session: Session, labeled_test_articles):
        """Articles about completely different domains are classified as DIFFERENT."""
        matching_svc = get_matching_service()
        art_econ = labeled_test_articles["same_1"]
        art_space = labeled_test_articles["different"]

        label, sim_score, conf_score, sigs = matching_svc.classify_article_pair(
            article_1=art_econ,
            article_2=art_space,
            headline_sim=0.08,
        )

        assert label == "DIFFERENT"
        assert conf_score >= 0.75

    def test_classify_with_incomplete_content(self, db_session: Session, labeled_test_articles):
        """Articles with headline-only content classify safely without throwing errors."""
        matching_svc = get_matching_service()
        art1 = labeled_test_articles["same_1"]
        art_head_only = labeled_test_articles["headline_only"]

        label, sim_score, conf_score, sigs = matching_svc.classify_article_pair(
            article_1=art1,
            article_2=art_head_only,
            headline_sim=0.89,
        )

        assert label in ("SAME", "RELATED")
        assert sigs.body_similarity is None  # Handled safely without error


class TestMatchingServiceStorageAndConstraints:
    """Tests candidate retrieval, PostgreSQL persistence, and uniqueness constraints."""

    def test_match_article_with_candidates_stores_in_database(
        self,
        db_session: Session,
        labeled_test_articles,
    ):
        """Matching candidates persists ArticleMatch records with canonical ID ordering."""
        # Pre-generate embeddings for all test articles
        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in labeled_test_articles.values()],
            embedding_type="headline",
            provider=provider,
        )

        matching_svc = get_matching_service()
        target = labeled_test_articles["same_1"]

        summary = matching_svc.match_article_with_candidates(
            db=db_session,
            article_id=target.id,
            candidate_limit=5,
            score_threshold=-1.0,  # Include all for testing
        )

        assert summary.query_article_id == target.id
        assert summary.candidates_retrieved > 0
        assert summary.matches_created > 0

        # Verify DB records enforce article_id_1 < article_id_2
        records = (
            db_session.query(ArticleMatch)
            .filter((ArticleMatch.article_id_1 == target.id) | (ArticleMatch.article_id_2 == target.id))
            .all()
        )
        assert len(records) > 0
        for r in records:
            assert r.article_id_1 < r.article_id_2
            assert r.match_label in ("SAME", "RELATED", "DIFFERENT")
            assert 0.0 <= r.similarity_score <= 1.0
            assert 0.0 <= r.confidence_score <= 1.0

    def test_duplicate_match_prevention_on_repeated_runs(
        self,
        db_session: Session,
        labeled_test_articles,
    ):
        """Repeated matching runs do not duplicate ArticleMatch rows."""
        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in labeled_test_articles.values()],
            embedding_type="headline",
            provider=provider,
        )

        matching_svc = get_matching_service()
        target = labeled_test_articles["same_1"]

        # Run 1: initial creation
        summary_1 = matching_svc.match_article_with_candidates(
            db=db_session,
            article_id=target.id,
            candidate_limit=5,
            score_threshold=-1.0,
        )
        initial_created = summary_1.matches_created
        assert initial_created > 0

        # Run 2: without force_reclassify -> matches should be skipped, count remains same
        summary_2 = matching_svc.match_article_with_candidates(
            db=db_session,
            article_id=target.id,
            candidate_limit=5,
            score_threshold=-1.0,
            force_reclassify=False,
        )
        assert summary_2.matches_created == 0
        assert summary_2.matches_skipped == initial_created

        # Total rows in DB should remain unchanged
        total_rows = db_session.query(ArticleMatch).count()
        assert total_rows == initial_created

    def test_nonexistent_article_raises_error(self, db_session: Session):
        """Attempting to match a non-existent article raises ValueError."""
        matching_svc = get_matching_service()
        with pytest.raises(ValueError, match="does not exist"):
            matching_svc.match_article_with_candidates(
                db=db_session,
                article_id=999999,
            )


class TestMatchingAPIEndpoints:
    """Tests the REST API endpoints for article matching and retrieval."""

    def test_api_match_article_candidates_success(
        self,
        client,
        db_session: Session,
        labeled_test_articles,
    ):
        """POST /api/articles/{article_id}/match triggers matching and returns summary."""
        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in labeled_test_articles.values()],
            embedding_type="headline",
            provider=provider,
        )

        target = labeled_test_articles["same_1"]
        response = client.post(
            f"/api/articles/{target.id}/match",
            json={"candidate_limit": 5, "score_threshold": -1.0},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query_article_id"] == target.id
        assert data["query_title"] == target.title
        assert len(data["matches"]) > 0

        first_match = data["matches"][0]
        assert first_match["match_label"] in ("SAME", "RELATED", "DIFFERENT")
        assert "article_1_title" in first_match
        assert "article_2_title" in first_match

    def test_api_get_article_matches_and_filter(
        self,
        client,
        db_session: Session,
        labeled_test_articles,
    ):
        """GET /api/articles/{article_id}/matches returns stored matches and supports label filtering."""
        provider = MockEmbeddingProvider(model_name="mock-model", dimensions=128)
        run_article_embedding_generation(
            db=db_session,
            article_ids=[a.id for a in labeled_test_articles.values()],
            embedding_type="headline",
            provider=provider,
        )

        target = labeled_test_articles["same_1"]
        # Trigger matching first
        client.post(f"/api/articles/{target.id}/match", json={"candidate_limit": 5, "score_threshold": -1.0})

        # Retrieve all matches
        resp_all = client.get(f"/api/articles/{target.id}/matches")
        assert resp_all.status_code == 200
        matches = resp_all.json()
        assert len(matches) > 0

        # Filter by SAME
        resp_filtered = client.get(f"/api/articles/{target.id}/matches?label=SAME")
        assert resp_filtered.status_code == 200
        for m in resp_filtered.json():
            assert m["match_label"] == "SAME"

    def test_api_get_match_by_id(
        self,
        client,
        db_session: Session,
        labeled_test_articles,
    ):
        """GET /api/matches/{match_id} retrieves a specific match record."""
        target = labeled_test_articles["same_1"]
        other = labeled_test_articles["same_2"]

        # Insert direct match
        match = ArticleMatch(
            article_id_1=min(target.id, other.id),
            article_id_2=max(target.id, other.id),
            match_label="SAME",
            similarity_score=0.92,
            confidence_score=0.95,
            model_name="multi_signal_classifier_v1",
        )
        db_session.add(match)
        db_session.commit()
        db_session.refresh(match)

        resp = client.get(f"/api/matches/{match.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == match.id
        assert data["match_label"] == "SAME"
        assert data["similarity_score"] == 0.92
        assert data["confidence_score"] == 0.95

    def test_api_get_match_by_id_not_found(self, client):
        """Returns 404 for an invalid match ID."""
        resp = client.get("/api/matches/999999")
        assert resp.status_code == 404
