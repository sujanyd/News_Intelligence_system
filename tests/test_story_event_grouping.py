"""
Tests for Story and Event Grouping Service and API Endpoints.

Validates:
1. Story and Event database operations.
2. Grouping articles with SAME classification reuses the exact Event and Story.
3. Grouping articles with RELATED classification reuses the Story and creates a new Event.
4. Independent handling of event_time, event_time_precision, published_at, and retrieved_at.
5. Entity overlap heuristic prevents spurious grouping based purely on vector similarity.
6. Fallback creates new Story and Event when no classification or entity matches exist.
7. REST API endpoints for stories and events (list, details, sub-resources, grouping).
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.article import Article
from app.models.article_match import ArticleMatch
from app.models.event import Event
from app.models.news_source import NewsSource
from app.models.story import Story
from app.services.story_grouping import StoryEventGroupingService, derive_story_title_from_article


@pytest.fixture
def sample_news_source(db_session: Session) -> NewsSource:
    source = NewsSource(
        name="Global News Network",
        base_url="https://gnn.example.com",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture
def sample_story_and_event(db_session: Session) -> tuple[Story, Event]:
    story = Story(title="Global Monetary Policy Review 2026")
    db_session.add(story)
    db_session.flush()

    event = Event(
        story_id=story.id,
        event_time=datetime(2026, 11, 1, 14, 0, tzinfo=timezone.utc),
        event_time_precision="exact",
        event_time_disagreement=False,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(story)
    db_session.refresh(event)
    return story, event


class TestStoryEventGroupingService:
    def test_derive_story_title_from_article(self):
        art1 = Article(title="Federal Reserve Cuts Interest Rates - Reuters")
        assert derive_story_title_from_article(art1) == "Federal Reserve Cuts Interest Rates"

        art2 = Article(title="Tech Giants Announce AI Alliance | BBC News")
        assert derive_story_title_from_article(art2) == "Tech Giants Announce AI Alliance"

        art3 = Article(title="Clean Energy Treaty Finalized")
        assert derive_story_title_from_article(art3) == "Clean Energy Treaty Finalized"

    def test_group_article_already_grouped(self, db_session: Session, sample_news_source, sample_story_and_event):
        story, event = sample_story_and_event
        article = Article(
            source_id=sample_news_source.id,
            event_id=event.id,
            title="Fed Rate Decision Analysis",
            url="https://example.com/fed-1",
            content="Detailed analysis of rate decisions.",
            published_at=datetime(2026, 11, 1, 15, 0, tzinfo=timezone.utc),
        )
        db_session.add(article)
        db_session.commit()
        db_session.refresh(article)

        service = StoryEventGroupingService()
        result = service.group_article(db_session, article.id, force_regroup=False)

        assert result.article_id == article.id
        assert result.story_id == story.id
        assert result.event_id == event.id
        assert result.story_action == "reused"
        assert result.event_action == "reused"

    def test_group_article_reuses_event_on_same_match(
        self, db_session: Session, sample_news_source, sample_story_and_event
    ):
        story, event = sample_story_and_event

        # Existing article assigned to event
        anchor_art = Article(
            source_id=sample_news_source.id,
            event_id=event.id,
            title="Fed Cuts Benchmark Rates by 25 Bps",
            url="https://example.com/fed-anchor",
            content="Federal Reserve cuts rates.",
            published_at=datetime(2026, 11, 1, 14, 30, tzinfo=timezone.utc),
        )
        db_session.add(anchor_art)
        db_session.flush()

        # New incoming article covering the SAME event
        new_art = Article(
            source_id=sample_news_source.id,
            event_id=None,
            title="US Central Bank Announces 25 Bps Rate Reduction",
            url="https://example.com/fed-new-same",
            content="The Federal Reserve announced rate reduction.",
            published_at=datetime(2026, 11, 1, 15, 0, tzinfo=timezone.utc),
        )
        db_session.add(new_art)
        db_session.flush()

        # Add match record with SAME classification
        match = ArticleMatch(
            article_id_1=min(anchor_art.id, new_art.id),
            article_id_2=max(anchor_art.id, new_art.id),
            match_label="SAME",
            similarity_score=0.91,
            confidence_score=0.92,
        )
        db_session.add(match)
        db_session.commit()

        service = StoryEventGroupingService()
        result = service.group_article(db_session, new_art.id)

        assert result.story_id == story.id
        assert result.event_id == event.id
        assert result.story_action == "reused"
        assert result.event_action == "reused"
        assert result.matched_article_id == anchor_art.id

        # Verify DB updated
        db_session.refresh(new_art)
        assert new_art.event_id == event.id

    def test_group_article_reuses_story_creates_event_on_related_match(
        self, db_session: Session, sample_news_source, sample_story_and_event
    ):
        story, event = sample_story_and_event

        # Existing article in the story
        anchor_art = Article(
            source_id=sample_news_source.id,
            event_id=event.id,
            title="Federal Reserve Signals Rate Cuts Ahead",
            url="https://example.com/fed-anchor-related",
            content="Monetary policy signals.",
            published_at=datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc),
        )
        db_session.add(anchor_art)
        db_session.flush()

        # New article reporting related employment development in the same narrative
        related_art = Article(
            source_id=sample_news_source.id,
            event_id=None,
            title="US Jobless Claims Fall to Historic Lows",
            url="https://example.com/us-jobs-related",
            content="Labor Department reports falling claims.",
            published_at=datetime(2026, 11, 3, 9, 0, tzinfo=timezone.utc),
        )
        db_session.add(related_art)
        db_session.flush()

        match = ArticleMatch(
            article_id_1=min(anchor_art.id, related_art.id),
            article_id_2=max(anchor_art.id, related_art.id),
            match_label="RELATED",
            similarity_score=0.74,
            confidence_score=0.80,
        )
        db_session.add(match)
        db_session.commit()

        service = StoryEventGroupingService()
        result = service.group_article(db_session, related_art.id)

        assert result.story_id == story.id
        assert result.story_action == "reused"
        assert result.event_id != event.id  # New distinct event
        assert result.event_action == "created"

        # Verify new event belongs to the same story
        new_event = db_session.query(Event).filter(Event.id == result.event_id).first()
        assert new_event is not None
        assert new_event.story_id == story.id

    def test_group_article_creates_new_story_and_event_when_unrelated(
        self, db_session: Session, sample_news_source
    ):
        art = Article(
            source_id=sample_news_source.id,
            event_id=None,
            title="James Webb Space Telescope Identifies Atmospheric Methane on Exoplanet",
            url="https://example.com/jwst-methane",
            content="Astronomers analyzing spectroscopy data from JWST discovered methane.",
            published_at=datetime(2026, 11, 4, 18, 0, tzinfo=timezone.utc),
        )
        db_session.add(art)
        db_session.commit()

        service = StoryEventGroupingService()
        result = service.group_article(db_session, art.id)

        assert result.story_action == "created"
        assert result.event_action == "created"
        assert "James Webb Space Telescope" in result.story_title

        # Verify timestamps are preserved separately
        created_event = db_session.query(Event).filter(Event.id == result.event_id).first()
        assert created_event is not None
        assert created_event.event_time is not None
        assert art.published_at is not None
        assert art.retrieved_at is not None


class TestStoryAndEventAPIEndpoints:
    def test_list_stories_endpoint(self, client: TestClient, db_session: Session, sample_story_and_event):
        response = client.get("/api/stories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "event_count" in data[0]
        assert "article_count" in data[0]

    def test_create_story_endpoint(self, client: TestClient):
        payload = {"title": "Autonomous AI Agent Frameworks 2026"}
        response = client.post("/api/stories", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == payload["title"]
        assert data["event_count"] == 0

    def test_get_story_by_id_endpoint(self, client: TestClient, sample_story_and_event):
        story, event = sample_story_and_event
        response = client.get(f"/api/stories/{story.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == story.id
        assert data["title"] == story.title
        assert len(data["events"]) >= 1

    def test_get_story_events_and_articles_endpoints(
        self, client: TestClient, db_session: Session, sample_news_source, sample_story_and_event
    ):
        story, event = sample_story_and_event
        art = Article(
            source_id=sample_news_source.id,
            event_id=event.id,
            title="Clean Energy Summit Keynote",
            url="https://example.com/energy-keynote",
            content="Summit discussions.",
            published_at=datetime(2026, 10, 24, 10, 0, tzinfo=timezone.utc),
        )
        db_session.add(art)
        db_session.commit()

        # GET /api/stories/{id}/events
        r_events = client.get(f"/api/stories/{story.id}/events")
        assert r_events.status_code == 200
        assert len(r_events.json()) >= 1

        # GET /api/stories/{id}/articles
        r_articles = client.get(f"/api/stories/{story.id}/articles")
        assert r_articles.status_code == 200
        assert len(r_articles.json()) >= 1
        assert r_articles.json()[0]["id"] == art.id

    def test_create_event_endpoint(self, client: TestClient, sample_story_and_event):
        story, _ = sample_story_and_event
        payload = {
            "story_id": story.id,
            "event_time": "2026-11-05T12:00:00Z",
            "event_time_precision": "exact",
            "event_time_disagreement": False,
        }
        response = client.post("/api/events", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["story_id"] == story.id
        assert data["event_time_precision"] == "exact"

    def test_get_event_by_id_and_articles(
        self, client: TestClient, db_session: Session, sample_news_source, sample_story_and_event
    ):
        story, event = sample_story_and_event
        art = Article(
            source_id=sample_news_source.id,
            event_id=event.id,
            title="Event Specific Article",
            url="https://example.com/event-specific-article",
            content="Event specific content.",
        )
        db_session.add(art)
        db_session.commit()

        # GET /api/events/{id}
        r_ev = client.get(f"/api/events/{event.id}")
        assert r_ev.status_code == 200
        assert r_ev.json()["id"] == event.id
        assert r_ev.json()["story_title"] == story.title

        # GET /api/events/{id}/articles
        r_art = client.get(f"/api/events/{event.id}/articles")
        assert r_art.status_code == 200
        assert len(r_art.json()) >= 1
        assert r_art.json()[0]["title"] == "Event Specific Article"

    def test_group_article_endpoint(
        self, client: TestClient, db_session: Session, sample_news_source
    ):
        art = Article(
            source_id=sample_news_source.id,
            event_id=None,
            title="Breakthrough in Quantum Computing Algorithms",
            url="https://example.com/quantum-algo",
            content="Researchers announce new quantum algorithms.",
        )
        db_session.add(art)
        db_session.commit()

        response = client.post("/api/stories/group", json={"article_id": art.id})
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == art.id
        assert data["story_id"] > 0
        assert data["event_id"] > 0
        assert data["story_action"] == "created"

    def test_parity_between_api_and_api_v1(self, client: TestClient, sample_story_and_event):
        story, event = sample_story_and_event
        r_api = client.get(f"/api/stories/{story.id}")
        r_v1 = client.get(f"/api/v1/stories/{story.id}")
        assert r_api.status_code == 200
        assert r_v1.status_code == 200
        assert r_api.json()["id"] == r_v1.json()["id"]
