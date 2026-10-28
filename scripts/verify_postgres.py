"""
PostgreSQL and Initial Core Models Verification Script.

Executes step-by-step verification of:
1. Database connectivity using environment variables
2. Four initial database models: NEWS_SOURCE, STORY, EVENT, ARTICLE
3. Foreign-key relationships and cascade integrity
4. FastAPI health-check endpoint

Usage:
    python scripts/verify_postgres.py
"""

import sys
import os
import uuid
from pathlib import Path
from datetime import datetime, timezone

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import NewsSource, Story, Event, Article
from fastapi.testclient import TestClient
from app.main import app


def run_verification():
    print("=" * 70)
    print("  News Bias and Framing Analysis System - PostgreSQL Verification")
    print("=" * 70)

    # 1. Test database connection
    print("\n[Step 1/5] Testing PostgreSQL Connection...")
    print(f"  Target DATABASE_URL: {settings.DATABASE_URL}")
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT current_database(), current_user, version();")).fetchone()
            print(f"  ✓ Connected to DB: '{result[0]}' as user: '{result[1]}'")
            print(f"  ✓ Server Version: {result[2].split(',')[0]}")
    except Exception as exc:
        print(f"  ✗ Connection failed: {exc}")
        print("\nTroubleshooting tips:")
        print("  - Ensure Docker container is running: docker compose up -d")
        print("  - Ensure .env has correct credentials and port (e.g. 5432 or 5433)")
        sys.exit(1)

    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        test_uid = str(uuid.uuid4())[:8]

        # 2. Insert one sample NewsSource
        print("\n[Step 2/5] Inserting Sample NewsSource...")
        source_name = f"Verification Wire {test_uid}"
        source = NewsSource(
            name=source_name,
            base_url="https://verification.example.com",
        )
        session.add(source)
        session.commit()
        session.refresh(source)
        print(f"  ✓ NewsSource created (ID: {source.id}, Name: '{source.name}', URL: '{source.base_url}')")

        # 3. Insert one sample Story
        print("\n[Step 3/5] Inserting Sample Story...")
        story_title = f"Global Energy Accord {test_uid}"
        story = Story(title=story_title)
        session.add(story)
        session.commit()
        session.refresh(story)
        print(f"  ✓ Story created (ID: {story.id}, Title: '{story.title}')")

        # 4. Insert one sample Event linked to the Story
        print("\n[Step 4/5] Inserting Sample Event and Article...")
        event_time = datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)
        event = Event(
            story_id=story.id,
            event_time=event_time,
            event_time_precision="exact",
            event_time_disagreement=False,
        )
        session.add(event)
        session.commit()
        session.refresh(event)
        print(f"  ✓ Event created (ID: {event.id}, Story ID: {event.story_id}, Time: {event.event_time})")

        # Insert Article linked to NewsSource and Event
        pub_time = datetime(2026, 10, 28, 15, 0, tzinfo=timezone.utc)
        article_url = f"https://verification.example.com/articles/accord-{test_uid}"
        article = Article(
            source_id=source.id,
            event_id=event.id,
            title=f"Ministers Sign Landmark Energy Accord {test_uid}",
            content="Delegates from over 100 nations ratified the historic agreement this afternoon...",
            url=article_url,
            published_at=pub_time,
        )
        session.add(article)
        session.commit()
        session.refresh(article)
        print(f"  ✓ Article created (ID: {article.id}, Title: '{article.title}')")
        print(f"    - Source FK: {article.source_id}")
        print(f"    - Event FK:  {article.event_id}")
        print(f"    - URL:       {article.url}")

        # 5. Query records and verify relationships
        print("\n[Step 5/5] Querying Records & Verifying Relationships...")
        queried_article = session.query(Article).filter_by(id=article.id).first()
        assert queried_article is not None, "Article not found by ID"
        assert queried_article.source.name == source_name, "Source relationship mismatch"
        assert queried_article.event.id == event.id, "Event relationship mismatch"
        assert queried_article.event.story.title == story_title, "Story relationship mismatch"

        queried_story = session.query(Story).filter_by(id=story.id).first()
        assert len(queried_story.events) == 1, "Story.events count mismatch"
        assert queried_story.events[0].id == event.id, "Story -> Event mismatch"

        queried_source = session.query(NewsSource).filter_by(id=source.id).first()
        assert len(queried_source.articles) == 1, "NewsSource.articles count mismatch"
        assert queried_source.articles[0].id == article.id, "NewsSource -> Article mismatch"

        print("  ✓ Foreign key traversal: Article -> NewsSource ('" + queried_article.source.name + "')")
        print("  ✓ Foreign key traversal: Article -> Event -> Story ('" + queried_article.event.story.title + "')")
        print("  ✓ Reverse relationship: Story -> Events list (Count: 1)")
        print("  ✓ Reverse relationship: NewsSource -> Articles list (Count: 1)")

        # Verify FastAPI Health-Check
        print("\n[Bonus] Verifying FastAPI Health Check Endpoint...")
        client = TestClient(app)
        res = client.get("/health")
        assert res.status_code == 200, f"Health check returned status {res.status_code}"
        print(f"  ✓ GET /health returned HTTP 200: {res.json()}")

        # Cleanup test records
        session.delete(article)
        session.delete(event)
        session.delete(story)
        session.delete(source)
        session.commit()
        print("  ✓ Test records cleaned up successfully.")

    finally:
        session.close()

    print("\n" + "=" * 70)
    print("  ALL VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_verification()
