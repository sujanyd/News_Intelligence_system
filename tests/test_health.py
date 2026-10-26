"""
Tests for Health Check and Root Endpoints.
"""

from fastapi import status
from app.core.config import settings


def test_health_check_endpoint(client):
    """
    Test that GET /health returns HTTP 200 with expected JSON schema.
    """
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK

    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["app_name"] == settings.PROJECT_NAME
    assert payload["environment"] == settings.ENVIRONMENT
    assert payload["version"] == settings.VERSION


def test_versioned_health_check_endpoint(client):
    """
    Test that GET /api/v1/health functions properly through the API router.
    """
    response = client.get(f"{settings.API_V1_PREFIX}/health")
    assert response.status_code == status.HTTP_200_OK

    payload = response.json()
    assert payload["status"] == "ok"


def test_root_endpoint(client):
    """
    Test that the root endpoint GET / returns HTTP 200 with API docs link.
    """
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK

    payload = response.json()
    assert "message" in payload
    assert payload["docs_url"] == "/docs"
    assert payload["health_url"] == "/health"
