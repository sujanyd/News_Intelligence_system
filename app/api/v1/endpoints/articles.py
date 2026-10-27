"""
Articles API Endpoints.

Provides endpoints to list, retrieve, and create news articles with support
for source filtering, pagination, and detailed retrieval.
"""

import hashlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.models.article import Article
from app.models.news_source import NewsSource
from app.models.event import Event
from app.schemas.article import (
    ArticleCreate,
    ArticleSummaryResponse,
    ArticleDetailResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=List[ArticleSummaryResponse],
    summary="List articles",
    description="Retrieve news articles with pagination and optional source filtering. Omits full text content for performance.",
)
def list_articles(
    source_id: Optional[int] = Query(None, description="Filter articles by news source ID"),
    limit: int = Query(50, ge=1, le=100, description="Max number of articles to return (1-100)"),
    offset: int = Query(0, ge=0, description="Number of articles to skip"),
    db: Session = Depends(get_db),
) -> List[Article]:
    """
    List articles with source filtering and pagination.
    Returns lightweight summary records without full text content.
    """
    query = db.query(Article).options(joinedload(Article.source))

    if source_id is not None:
        query = query.filter(Article.source_id == source_id)

    articles = (
        query.order_by(
            Article.published_at.desc().nullslast(),
            Article.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    return articles


@router.get(
    "/{article_id}",
    response_model=ArticleDetailResponse,
    summary="Retrieve an article",
    description="Get complete article details including full text content and duplicate detection metadata.",
    responses={
        404: {"description": "Article not found"},
    },
)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
) -> Article:
    """
    Retrieve a single article by ID. Returns 404 if not found.
    """
    article = (
        db.query(Article)
        .options(joinedload(Article.source))
        .filter(Article.id == article_id)
        .first()
    )
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with ID {article_id} not found",
        )
    return article


@router.post(
    "",
    response_model=ArticleDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an article",
    description="Manually create a news article for testing, ingestion, or verification.",
    responses={
        404: {"description": "News source or event not found"},
        409: {"description": "Article with this URL already exists"},
        422: {"description": "Validation error in request payload"},
    },
)
def create_article(
    article_in: ArticleCreate,
    db: Session = Depends(get_db),
) -> Article:
    """
    Create an article record. Validates that the publishing source exists,
    prevents duplicate URLs, and computes content hash.
    """
    # 1. Validate that the specified news source exists
    source = db.query(NewsSource).filter(NewsSource.id == article_in.source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"News source with ID {article_in.source_id} not found",
        )

    # 2. If event_id is provided, validate that the event exists
    if article_in.event_id is not None:
        event = db.query(Event).filter(Event.id == article_in.event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {article_in.event_id} not found",
            )

    # 3. Check for duplicate URL
    existing_article = db.query(Article).filter(Article.url == article_in.url).first()
    if existing_article:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Article with this URL already exists",
        )

    # 4. Compute SHA-256 content hash if content is present
    content_hash = None
    if article_in.content:
        content_hash = hashlib.sha256(article_in.content.encode("utf-8")).hexdigest()

    # 5. Create Article instance
    new_article = Article(
        source_id=article_in.source_id,
        event_id=article_in.event_id,
        title=article_in.title,
        content=article_in.content,
        url=article_in.url,
        content_availability=article_in.content_availability,
        canonical_url=article_in.canonical_url,
        content_hash=content_hash,
        published_at=article_in.published_at,
    )
    db.add(new_article)

    try:
        db.commit()
        db.refresh(new_article)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Article with this URL already exists",
        )

    return new_article
