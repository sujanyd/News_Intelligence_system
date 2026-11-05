"""
Stories API Endpoints.

Provides endpoints to:
1. List all stories with event and article counts.
2. Create a new story manually.
3. Retrieve story details including its events and articles.
4. Retrieve events belonging to a story.
5. Retrieve articles belonging to a story.
6. Trigger automated story & event grouping for an article or all ungrouped articles.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.article import Article
from app.models.event import Event
from app.models.story import Story
from app.schemas.article import ArticleSummaryResponse
from app.schemas.story_event import (
    EventResponse,
    GroupArticleRequest,
    GroupArticleResult,
    StoryCreate,
    StoryDetailResponse,
    StoryResponse,
    StoryUpdate,
)
from app.services.story_grouping import get_grouping_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=List[StoryResponse],
    summary="List all stories",
    description="Returns a paginated list of all stories along with event and article counts.",
)
def list_stories(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Limit for pagination"),
    db: Session = Depends(get_db),
):
    stories = (
        db.query(Story)
        .options(joinedload(Story.events).joinedload(Event.articles))
        .order_by(Story.created_at.desc(), Story.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for s in stories:
        ev_count = len(s.events)
        art_count = sum(len(ev.articles) for ev in s.events)
        result.append(
            StoryResponse(
                id=s.id,
                title=s.title,
                created_at=s.created_at,
                event_count=ev_count,
                article_count=art_count,
            )
        )
    return result


@router.post(
    "",
    response_model=StoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new story",
    description="Manually registers a new story narrative.",
)
def create_story(
    payload: StoryCreate,
    db: Session = Depends(get_db),
):
    story = Story(title=payload.title)
    db.add(story)
    db.commit()
    db.refresh(story)

    return StoryResponse(
        id=story.id,
        title=story.title,
        created_at=story.created_at,
        event_count=0,
        article_count=0,
    )


@router.get(
    "/{story_id}",
    response_model=StoryDetailResponse,
    summary="Get story details",
    description="Retrieves a story by ID along with its constituent events and articles.",
)
def get_story_by_id(
    story_id: int,
    db: Session = Depends(get_db),
):
    story = (
        db.query(Story)
        .options(
            joinedload(Story.events).joinedload(Event.articles).joinedload(Article.source)
        )
        .filter(Story.id == story_id)
        .first()
    )
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story with ID {story_id} does not exist.",
        )

    events_out = []
    articles_out = []
    for ev in story.events:
        events_out.append(
            EventResponse(
                id=ev.id,
                story_id=ev.story_id,
                event_time=ev.event_time,
                event_time_precision=ev.event_time_precision or "unknown",
                event_time_disagreement=ev.event_time_disagreement,
                article_count=len(ev.articles),
            )
        )
        for art in ev.articles:
            articles_out.append(
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
            )

    return StoryDetailResponse(
        id=story.id,
        title=story.title,
        created_at=story.created_at,
        event_count=len(events_out),
        article_count=len(articles_out),
        events=events_out,
        articles=articles_out,
    )


@router.get(
    "/{story_id}/events",
    response_model=List[EventResponse],
    summary="Get events belonging to a story",
    description="Lists all specific events linked to this story narrative.",
)
def get_story_events(
    story_id: int,
    db: Session = Depends(get_db),
):
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story with ID {story_id} does not exist.",
        )

    events = (
        db.query(Event)
        .options(joinedload(Event.articles))
        .filter(Event.story_id == story_id)
        .order_by(Event.event_time.asc().nullslast(), Event.id.asc())
        .all()
    )

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


@router.get(
    "/{story_id}/articles",
    response_model=List[ArticleSummaryResponse],
    summary="Get articles belonging to a story",
    description="Returns all news articles mapped across all events within this story.",
)
def get_story_articles(
    story_id: int,
    db: Session = Depends(get_db),
):
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story with ID {story_id} does not exist.",
        )

    articles = (
        db.query(Article)
        .join(Event, Article.event_id == Event.id)
        .options(joinedload(Article.source))
        .filter(Event.story_id == story_id)
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


@router.post(
    "/group",
    response_model=GroupArticleResult,
    summary="Group an article into story and event",
    description=(
        "Analyzes an article using pairwise classifications (SAME, RELATED, DIFFERENT), "
        "shared entities, and publication timestamps to assign or create appropriate Story and Event."
    ),
)
def group_article_endpoint(
    payload: GroupArticleRequest,
    db: Session = Depends(get_db),
):
    service = get_grouping_service()
    try:
        return service.group_article(
            db=db,
            article_id=payload.article_id,
            force_regroup=payload.force_regroup,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Story/Event grouping failed for article %d: %s", payload.article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grouping failed: {exc}",
        )


@router.post(
    "/group/batch",
    response_model=List[GroupArticleResult],
    summary="Batch group all ungrouped articles",
    description="Iterates through articles without assigned event_id and groups them.",
)
def batch_group_articles(
    limit: int = Query(50, ge=1, le=200, description="Max ungrouped articles to process"),
    db: Session = Depends(get_db),
):
    service = get_grouping_service()
    try:
        return service.group_ungrouped_articles(db=db, limit=limit)
    except Exception as exc:
        logger.error("Batch grouping failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch grouping failed: {exc}",
        )
