"""
Events API Endpoints.

Provides endpoints to:
1. List all events with story and article counts.
2. Create a new event under a story.
3. Retrieve event details including mapped articles.
4. Retrieve articles belonging to a specific event.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.article import Article
from app.models.event import Event
from app.models.story import Story
from app.schemas.article import ArticleSummaryResponse
from app.schemas.story_event import (
    EventCreate,
    EventDetailResponse,
    EventResponse,
    EventUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=List[EventResponse],
    summary="List all events",
    description="Returns a paginated list of all events with article counts.",
)
def list_events(
    story_id: Optional[int] = Query(None, description="Optional filter by story ID"),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Limit for pagination"),
    db: Session = Depends(get_db),
):
    query = db.query(Event).options(joinedload(Event.articles))
    if story_id is not None:
        query = query.filter(Event.story_id == story_id)

    events = query.order_by(Event.event_time.desc().nullslast(), Event.id.desc()).offset(skip).limit(limit).all()

    return [
        EventResponse(
            id=ev.id,
            story_id=ev.story_id,
            event_time=ev.event_time,
            event_time_precision=ev.event_time_precision or "unknown",
            event_time_disagreement=ev.event_time_disagreement,
            article_count=len(ev.articles),
        )
        for ev in events
    ]


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event",
    description="Registers a new event belonging to an existing Story.",
)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
):
    story = db.query(Story).filter(Story.id == payload.story_id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent Story with ID {payload.story_id} does not exist.",
        )

    event = Event(
        story_id=payload.story_id,
        event_time=payload.event_time,
        event_time_precision=payload.event_time_precision,
        event_time_disagreement=payload.event_time_disagreement,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return EventResponse(
        id=event.id,
        story_id=event.story_id,
        event_time=event.event_time,
        event_time_precision=event.event_time_precision or "unknown",
        event_time_disagreement=event.event_time_disagreement,
        article_count=0,
    )


@router.get(
    "/{event_id}",
    response_model=EventDetailResponse,
    summary="Get event details",
    description="Retrieves specific event details, parent story title, and linked articles.",
)
def get_event_by_id(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .options(
            joinedload(Event.story),
            joinedload(Event.articles).joinedload(Article.source),
        )
        .filter(Event.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} does not exist.",
        )

    articles_out = [
        ArticleSummaryResponse(
            id=art.id,
            source_id=art.source_id,
            source_name=art.source.name if art.source else None,
            event_id=art.event_id,
            title=art.title,
            url=art.url,
            content_availability=art.content_availability,
            published_at=art.published_at,
            retrieved_at=art.retrieved_at,
            created_at=art.created_at,
        )
        for art in event.articles
    ]

    return EventDetailResponse(
        id=event.id,
        story_id=event.story_id,
        story_title=event.story.title if event.story else None,
        event_time=event.event_time,
        event_time_precision=event.event_time_precision or "unknown",
        event_time_disagreement=event.event_time_disagreement,
        article_count=len(articles_out),
        articles=articles_out,
    )


@router.get(
    "/{event_id}/articles",
    response_model=List[ArticleSummaryResponse],
    summary="Get articles belonging to an event",
    description="Returns all news articles that report this specific real-world event.",
)
def get_event_articles(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} does not exist.",
        )

    articles = (
        db.query(Article)
        .options(joinedload(Article.source))
        .filter(Article.event_id == event_id)
        .order_by(Article.published_at.desc().nullslast(), Article.id.desc())
        .all()
    )

    return [
        ArticleSummaryResponse(
            id=art.id,
            source_id=art.source_id,
            source_name=art.source.name if art.source else None,
            event_id=art.event_id,
            title=art.title,
            url=art.url,
            content_availability=art.content_availability,
            published_at=art.published_at,
            retrieved_at=art.retrieved_at,
            created_at=art.created_at,
        )
        for art in articles
    ]
