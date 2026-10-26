"""
Health check route endpoint.

Provides an endpoint to verify that the API server is alive, reachable,
and returning valid configuration metadata.
"""

from fastapi import APIRouter, status
from app.core.config import settings
from app.schemas.health import HealthCheckResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Health Check",
    description="Returns current service status, project name, environment, and version.",
)
async def get_health() -> HealthCheckResponse:
    """
    Health check handler returning application status.
    """
    return HealthCheckResponse(
        status="ok",
        app_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
    )
