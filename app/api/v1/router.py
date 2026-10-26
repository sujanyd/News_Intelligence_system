"""
API v1 Central Router.

Combines all sub-routers (e.g., health, articles, bias analysis)
into a single versioned router.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health

api_v1_router = APIRouter()

# Register health check endpoint under API v1 (/api/v1/health)
api_v1_router.include_router(health.router)
