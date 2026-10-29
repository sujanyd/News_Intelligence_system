"""
API v1 Central Router.

Combines all sub-routers (health, sources, articles) into a single central router.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, sources, articles, ingestion

api_v1_router = APIRouter()

# Register endpoints under API v1
api_v1_router.include_router(health.router)
api_v1_router.include_router(sources.router, prefix="/sources", tags=["News Sources"])
api_v1_router.include_router(articles.router, prefix="/articles", tags=["Articles"])
api_v1_router.include_router(ingestion.router, prefix="/ingestion", tags=["RSS Ingestion"])
