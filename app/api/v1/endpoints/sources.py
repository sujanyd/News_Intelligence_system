"""
News Sources API Endpoints.

Provides endpoints to list, retrieve, and register news publishing organizations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.db.session import get_db
from app.models.news_source import NewsSource
from app.schemas.news_source import NewsSourceCreate, NewsSourceResponse

router = APIRouter()


@router.get(
    "",
    response_model=List[NewsSourceResponse],
    summary="List news sources",
    description="Retrieve all registered news sources with optional pagination.",
)
def list_sources(
    limit: Optional[int] = Query(None, ge=1, le=100, description="Max number of sources to return"),
    offset: int = Query(0, ge=0, description="Number of sources to skip"),
    db: Session = Depends(get_db),
) -> List[NewsSource]:
    """
    Returns a list of news sources ordered alphabetically by name.
    """
    query = db.query(NewsSource).order_by(NewsSource.name.asc())
    if offset > 0:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.get(
    "/{source_id}",
    response_model=NewsSourceResponse,
    summary="Retrieve a news source",
    description="Get metadata for a single news source by its ID.",
    responses={
        404: {"description": "News source not found"},
    },
)
def get_source(
    source_id: int,
    db: Session = Depends(get_db),
) -> NewsSource:
    """
    Fetch a single news source by ID. Returns 404 if the source does not exist.
    """
    source = db.query(NewsSource).filter(NewsSource.id == source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"News source with ID {source_id} not found",
        )
    return source


@router.post(
    "",
    response_model=NewsSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a news source",
    description="Register a new media publisher or news outlet.",
    responses={
        409: {"description": "News source with this name already exists"},
        422: {"description": "Validation error in request payload"},
    },
)
def create_source(
    source_in: NewsSourceCreate,
    db: Session = Depends(get_db),
) -> NewsSource:
    """
    Create a new news source. Checks for duplicates and enforces uniqueness.
    """
    # Check for existing source with same name (case-insensitive)
    existing_source = (
        db.query(NewsSource)
        .filter(func.lower(NewsSource.name) == func.lower(source_in.name))
        .first()
    )
    if existing_source:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="News source with this name already exists",
        )

    new_source = NewsSource(
        name=source_in.name,
        base_url=str(source_in.base_url),
    )
    db.add(new_source)

    try:
        db.commit()
        db.refresh(new_source)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="News source with this name already exists",
        )

    return new_source
