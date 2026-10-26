"""
Database seed script.

Inserts initial sample data (Source, Story, Event, Article)
and verifies their foreign-key relationships.

Usage:
    python -m app.db.seed
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.session import engine, SessionLocal
from app.models import Base, NewsSource, Story, Event, Article


def seed_database(db: Session) -> dict:
    """
    Populates sample data into the database and returns the inserted instances.
    """
    # 1. Insert a NewsSource
    source = db.query(NewsSource).filter_by(name="Reuters").first()
    if not source:
        source = NewsSource(
            name="Reuters",
            base_url="https://www.reuters.com",
        )
        db.add(source)
        db.flush()

    # 2. Insert a Story (overarching topic)
    story = db.query(Story).filter_by(title="Global Clean Energy Summit 2026").first()
    if not story:
        story = Story(
            title="Global Clean Energy Summit 2026",
        )
        db.add(story)
        db.flush()

    # 3. Insert an Event linked to the Story
    event = db.query(Event).filter_by(story_id=story.id).first()
    if not event:
        event = Event(
            story_id=story.id,
            event_time=datetime(2026, 10, 24, 14, 30, tzinfo=timezone.utc),
            event_time_precision="exact",
            event_time_disagreement=False,
        )
        db.add(event)
        db.flush()

    # 4. Insert an Article linked to the NewsSource and Event
    sample_url = "https://www.reuters.com/sustainability/clean-energy-summit-2026-pact-signed"
    article = db.query(Article).filter_by(url=sample_url).first()
    if not article:
        article = Article(
            source_id=source.id,
            event_id=event.id,
            title="World Leaders Finalize Landmark Clean Energy Transition Pact",
            content=(
                "Over 190 delegations reached a historic consensus in Geneva today, "
                "committing to triple renewable capacity investments over the next decade."
            ),
            url=sample_url,
            published_at=datetime(2026, 10, 24, 15, 0, tzinfo=timezone.utc),
        )
        db.add(article)
        db.flush()

    db.commit()
    db.refresh(source)
    db.refresh(story)
    db.refresh(event)
    db.refresh(article)

    return {
        "source": source,
        "story": story,
        "event": event,
        "article": article,
    }


def run_seed() -> None:
    """Creates tables if not present and runs the seed process."""
    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)

    print("Seeding sample data...")
    db = SessionLocal()
    try:
        data = seed_database(db)
        print("✓ Sample data seeded successfully!")
        print(f"  - Source: {data['source'].name} ({data['source'].base_url})")
        print(f"  - Story: {data['story'].title}")
        print(f"  - Event: ID={data['event'].id}, Time={data['event'].event_time}, Precision={data['event'].event_time_precision}")
        print(f"  - Article: '{data['article'].title}' published by {data['article'].source.name}")
        print(f"  - Relationship Check: Story '{data['story'].title}' has {len(data['story'].events)} event(s)")
        print(f"  - Relationship Check: Event {data['event'].id} has {len(data['event'].articles)} article(s)")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
