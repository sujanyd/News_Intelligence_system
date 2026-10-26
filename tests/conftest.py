"""
Pytest configuration and shared fixtures.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """
    Fixture providing a test client configured for the FastAPI app.
    Enables sending HTTP requests to the backend without spinning up a live server.
    """
    with TestClient(app) as test_client:
        yield test_client
