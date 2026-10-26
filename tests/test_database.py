"""
Tests for Core Database Models and Relationships.

Validates that NewsSource, Story, Event, and Article can be created,
queried, and that their foreign-key relationships function as intended.
"""

from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError

from app.models import NewsSource, Story, Event, Article
from app.db.seed import seed_database


def _normalize_tz(dt: datetime | None) -> datetime | None:
    """Normalize datetime to UTC if naive (e.g. SQLite dialect)."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def test_create_news_source(db_session):
    """Test creating and querying a NewsSource record."""
    source = NewsSource(
        name="Associated Press",
        base_url="https://apnews.com",
    )
    db_session.add(source)
    db_session.commit()

    retrieved = db_session.query(NewsSource).filter_by(name="Associated Press").first()
    assert retrieved is not None
    assert retrieved.id is not None
    assert retrieved.name == "Associated Press"
    assert retrieved.base_url == "https://apnews.com"
    assert retrieved.created_at is not None


def test_news_source_unique_name_constraint(db_session):
    """Test that duplicate source names are rejected."""
    source1 = NewsSource(name="BBC", base_url="https://bbc.com")
    source2 = NewsSource(name="BBC", base_url="https://bbc.co.uk")
    db_session.add(source1)
    db_session.commit()

    db_session.add(source2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_create_story_and_event_relationship(db_session):
    """Test creating a Story and an associated Event, checking the relationship."""
    story = Story(title="Mars Exploration Rover 2026")
    db_session.add(story)
    db_session.commit()

    event_time = datetime(2026, 8, 12, 10, 0, tzinfo=timezone.utc)
    event = Event(
        story_id=story.id,
        event_time=event_time,
        event_time_precision="exact",
        event_time_disagreement=False,
    )
    db_session.add(event)
    db_session.commit()

    # Query story and access events relationship
    retrieved_story = db_session.query(Story).filter_by(id=story.id).first()
    assert len(retrieved_story.events) == 1
    assert retrieved_story.events[0].id == event.id
    assert _normalize_tz(retrieved_story.events[0].event_time) == event_time
    assert retrieved_story.events[0].event_time_precision == "exact"
    assert retrieved_story.events[0].event_time_disagreement is False

    # Check back-population from event to story
    assert event.story.id == story.id
    assert event.story.title == "Mars Exploration Rover 2026"


def test_create_article_with_source_and_event(db_session):
    """Test creating an Article linked to a NewsSource and an Event."""
    # Setup source and story/event
    source = NewsSource(name="The Guardian", base_url="https://theguardian.com")
    story = Story(title="Renewable Energy Transition")
    db_session.add_all([source, story])
    db_session.commit()

    event = Event(
        story_id=story.id,
        event_time=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
        event_time_precision="date",
    )
    db_session.add(event)
    db_session.commit()

    pub_time = datetime(2026, 5, 1, 14, 30, tzinfo=timezone.utc)
    article = Article(
        source_id=source.id,
        event_id=event.id,
        title="Solar Generation Hits Record Highs",
        content="Solar energy production reached historical milestones this quarter...",
        url="https://theguardian.com/environment/solar-record-2026",
        published_at=pub_time,
    )
    db_session.add(article)
    db_session.commit()

    # Query article and verify relationships
    saved_article = db_session.query(Article).filter_by(url="https://theguardian.com/environment/solar-record-2026").first()
    assert saved_article is not None
    assert saved_article.source.name == "The Guardian"
    assert saved_article.event.id == event.id
    assert saved_article.event.story.title == "Renewable Energy Transition"

    # Verify reverse relationship from source to articles
    assert len(source.articles) == 1
    assert source.articles[0].id == saved_article.id

    # Verify reverse relationship from event to articles
    assert len(event.articles) == 1
    assert event.articles[0].id == saved_article.id


def test_event_time_independent_from_article_timestamps(db_session):
    """
    Requirement 7 Verification:
    Verify event occurrence time is completely distinct from
    article publication and retrieval times.
    """
    source = NewsSource(name="TechCrunch", base_url="https://techcrunch.com")
    story = Story(title="AI Breakthrough Announcement")
    db_session.add_all([source, story])
    db_session.commit()

    # Incident happened at 08:00 UTC
    incident_time = datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)
    event = Event(story_id=story.id, event_time=incident_time, event_time_precision="exact")
    db_session.add(event)
    db_session.commit()

    # Article published at 11:30 UTC
    publish_time = datetime(2026, 9, 15, 11, 30, tzinfo=timezone.utc)
    article = Article(
        source_id=source.id,
        event_id=event.id,
        title="New Open-Source Model Released",
        content="A research consortium has released a new foundation model...",
        url="https://techcrunch.com/2026/09/15/open-source-model",
        published_at=publish_time,
    )
    db_session.add(article)
    db_session.commit()

    retrieved_article = db_session.query(Article).filter_by(id=article.id).first()
    retrieved_event = db_session.query(Event).filter_by(id=event.id).first()

    assert _normalize_tz(retrieved_event.event_time) == incident_time
    assert _normalize_tz(retrieved_article.published_at) == publish_time
    assert retrieved_article.retrieved_at is not None
    # Confirm they are distinct timestamps
    assert _normalize_tz(retrieved_event.event_time) != _normalize_tz(retrieved_article.published_at)
    assert _normalize_tz(retrieved_article.published_at) != _normalize_tz(retrieved_article.retrieved_at)


def test_seed_database_function(db_session):
    """
    Requirement 8 & 9 Verification:
    Demonstrate that the seed script inserts and queries one source,
    story, event, and article with their relationships.
    """
    data = seed_database(db_session)

    assert data["source"].name == "Reuters"
    assert data["story"].title == "Global Clean Energy Summit 2026"
    assert data["event"].story_id == data["story"].id
    assert data["article"].source_id == data["source"].id
    assert data["article"].event_id == data["event"].id

    # Query back through relationships
    assert data["story"].events[0].id == data["event"].id
    assert data["event"].articles[0].id == data["article"].id
    assert data["article"].source.name == "Reuters"
    assert data["article"].event.story.title == "Global Clean Energy Summit 2026"
