"""
Tests for News Sources and Articles API Endpoints.

Validates:
- News source creation, uniqueness, retrieval, and listing.
- Article creation, URL uniqueness, foreign key validation, retrieval, and listing.
- Source filtering and pagination for articles.
- Content omission in summary listings (Requirement 9).
- Error responses (404, 409, 422).
- Route compatibility across /api and /api/v1 prefixes.
"""

import pytest
from fastapi.testclient import TestClient


class TestNewsSourcesAPI:
    """Test suite for /api/sources endpoints."""

    def test_list_sources_empty(self, client: TestClient):
        """GET /api/sources returns an empty list when no sources exist."""
        response = client.get("/api/sources")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_source_success(self, client: TestClient):
        """POST /api/sources creates a source and returns 201 with metadata."""
        payload = {
            "name": "Reuters",
            "base_url": "https://www.reuters.com",
        }
        response = client.post("/api/sources", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["id"] is not None
        assert data["name"] == "Reuters"
        assert data["base_url"] == "https://www.reuters.com"
        assert "created_at" in data

    def test_create_source_duplicate_conflict(self, client: TestClient):
        """POST /api/sources returns 409 Conflict when creating a source with duplicate name."""
        payload = {
            "name": "Associated Press",
            "base_url": "https://apnews.com",
        }
        res1 = client.post("/api/sources", json=payload)
        assert res1.status_code == 201

        # Attempt to create duplicate (case-insensitive test)
        res2 = client.post("/api/sources", json={"name": "associated press", "base_url": "https://apnews.com"})
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"]

    def test_create_source_validation_errors(self, client: TestClient):
        """POST /api/sources returns 422 for invalid inputs."""
        # Blank name
        res1 = client.post("/api/sources", json={"name": "   ", "base_url": "https://example.com"})
        assert res1.status_code == 422

        # Invalid URL scheme
        res2 = client.post("/api/sources", json={"name": "Test Outlet", "base_url": "ftp://example.com"})
        assert res2.status_code == 422

        # Missing required fields
        res3 = client.post("/api/sources", json={"name": "Missing Base URL"})
        assert res3.status_code == 422

    def test_get_source_by_id_success(self, client: TestClient):
        """GET /api/sources/{id} retrieves the source by its ID."""
        created = client.post("/api/sources", json={"name": "BBC", "base_url": "https://www.bbc.com"}).json()
        source_id = created["id"]

        response = client.get(f"/api/sources/{source_id}")
        assert response.status_code == 200
        assert response.json()["id"] == source_id
        assert response.json()["name"] == "BBC"

    def test_get_source_by_id_not_found(self, client: TestClient):
        """GET /api/sources/{id} returns 404 if source does not exist."""
        response = client.get("/api/sources/999999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_list_sources_ordered_and_paginated(self, client: TestClient):
        """GET /api/sources returns sources sorted by name and supports pagination."""
        client.post("/api/sources", json={"name": "The Hindu", "base_url": "https://thehindu.com"})
        client.post("/api/sources", json={"name": "Al Jazeera", "base_url": "https://aljazeera.com"})
        client.post("/api/sources", json={"name": "Bloomberg", "base_url": "https://bloomberg.com"})

        # Alphabetical order: Al Jazeera, Bloomberg, The Hindu
        res = client.get("/api/sources")
        assert res.status_code == 200
        names = [s["name"] for s in res.json()]
        assert names == ["Al Jazeera", "Bloomberg", "The Hindu"]

        # Pagination: limit=2
        res_limit = client.get("/api/sources?limit=2")
        assert len(res_limit.json()) == 2
        assert [s["name"] for s in res_limit.json()] == ["Al Jazeera", "Bloomberg"]

        # Pagination: offset=1, limit=1
        res_offset = client.get("/api/sources?offset=1&limit=1")
        assert len(res_offset.json()) == 1
        assert res_offset.json()[0]["name"] == "Bloomberg"


class TestArticlesAPI:
    """Test suite for /api/articles endpoints."""

    @pytest.fixture
    def setup_sources(self, client: TestClient):
        """Creates two news sources for article testing."""
        s1 = client.post("/api/sources", json={"name": "Source Alpha", "base_url": "https://alpha.news"}).json()
        s2 = client.post("/api/sources", json={"name": "Source Beta", "base_url": "https://beta.news"}).json()
        return s1, s2

    def test_list_articles_empty(self, client: TestClient):
        """GET /api/articles returns an empty list when no articles exist."""
        response = client.get("/api/articles")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_article_success(self, client: TestClient, setup_sources):
        """POST /api/articles creates an article and returns 201 with full details."""
        s1, _ = setup_sources
        payload = {
            "source_id": s1["id"],
            "title": "Renewable Energy Transition Accelerates Globally",
            "content": "Global investments in clean energy technologies reached new milestones this quarter.",
            "url": "https://alpha.news/energy/transition-2026",
            "content_availability": "full_text",
            "published_at": "2026-10-27T10:00:00Z",
        }
        response = client.post("/api/articles", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["id"] is not None
        assert data["source_id"] == s1["id"]
        assert data["source_name"] == "Source Alpha"
        assert data["title"] == payload["title"]
        assert data["content"] == payload["content"]
        assert data["url"] == payload["url"]
        assert data["content_hash"] is not None
        assert len(data["content_hash"]) == 64  # SHA-256 hex string

    def test_create_article_duplicate_url_conflict(self, client: TestClient, setup_sources):
        """POST /api/articles returns 409 Conflict when attempting to insert duplicate URL."""
        s1, s2 = setup_sources
        payload = {
            "source_id": s1["id"],
            "title": "First Article",
            "content": "Content text here.",
            "url": "https://news.example.com/unique-article-1",
        }
        res1 = client.post("/api/articles", json=payload)
        assert res1.status_code == 201

        # Second article with identical URL
        duplicate_payload = {
            "source_id": s2["id"],
            "title": "Duplicate URL Article",
            "content": "Different content.",
            "url": "https://news.example.com/unique-article-1",
        }
        res2 = client.post("/api/articles", json=duplicate_payload)
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"].lower()

    def test_create_article_missing_source(self, client: TestClient):
        """POST /api/articles returns 404 if source_id does not exist."""
        payload = {
            "source_id": 999999,
            "title": "Orphan Article",
            "url": "https://example.com/orphan",
        }
        response = client.post("/api/articles", json=payload)
        assert response.status_code == 404
        assert "news source with id 999999 not found" in response.json()["detail"].lower()

    def test_create_article_invalid_inputs(self, client: TestClient, setup_sources):
        """POST /api/articles returns 422 for blank title or invalid URL format."""
        s1, _ = setup_sources

        # Blank title
        res1 = client.post("/api/articles", json={"source_id": s1["id"], "title": "   ", "url": "https://ok.com"})
        assert res1.status_code == 422

        # Invalid URL scheme
        res2 = client.post("/api/articles", json={"source_id": s1["id"], "title": "Valid", "url": "not-a-url"})
        assert res2.status_code == 422

    def test_get_article_by_id_success(self, client: TestClient, setup_sources):
        """GET /api/articles/{id} returns full article details including body content."""
        s1, _ = setup_sources
        created = client.post(
            "/api/articles",
            json={
                "source_id": s1["id"],
                "title": "Deep Dive into Economic Policy",
                "content": "Complete in-depth analysis paragraph.",
                "url": "https://alpha.news/economy/deep-dive",
            },
        ).json()
        article_id = created["id"]

        response = client.get(f"/api/articles/{article_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == article_id
        assert data["title"] == "Deep Dive into Economic Policy"
        assert data["content"] == "Complete in-depth analysis paragraph."
        assert data["source_name"] == "Source Alpha"

    def test_get_article_by_id_not_found(self, client: TestClient):
        """GET /api/articles/{id} returns 404 if article ID does not exist."""
        response = client.get("/api/articles/999999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_list_articles_omits_content(self, client: TestClient, setup_sources):
        """GET /api/articles omits heavy full-text content in summary list (Requirement 9)."""
        s1, _ = setup_sources
        client.post(
            "/api/articles",
            json={
                "source_id": s1["id"],
                "title": "Article with Large Content",
                "content": "Very long article body text that should not bloat the list response payload.",
                "url": "https://alpha.news/large-article",
            },
        )

        response = client.get("/api/articles")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        # 'content' field must NOT be in the summary response object
        assert "content" not in items[0]
        assert items[0]["title"] == "Article with Large Content"
        assert items[0]["source_name"] == "Source Alpha"

    def test_list_articles_filter_by_source(self, client: TestClient, setup_sources):
        """GET /api/articles?source_id={id} correctly filters articles by publisher."""
        s1, s2 = setup_sources
        client.post("/api/articles", json={"source_id": s1["id"], "title": "A1", "url": "https://alpha.news/1"})
        client.post("/api/articles", json={"source_id": s1["id"], "title": "A2", "url": "https://alpha.news/2"})
        client.post("/api/articles", json={"source_id": s2["id"], "title": "B1", "url": "https://beta.news/1"})

        # Filter by source 1
        res1 = client.get(f"/api/articles?source_id={s1['id']}")
        assert res1.status_code == 200
        assert len(res1.json()) == 2
        assert all(a["source_id"] == s1["id"] for a in res1.json())

        # Filter by source 2
        res2 = client.get(f"/api/articles?source_id={s2['id']}")
        assert res2.status_code == 200
        assert len(res2.json()) == 1
        assert res2.json()[0]["title"] == "B1"

    def test_list_articles_pagination(self, client: TestClient, setup_sources):
        """GET /api/articles?limit={limit}&offset={offset} paginates results predictably."""
        s1, _ = setup_sources
        for i in range(1, 8):
            client.post(
                "/api/articles",
                json={
                    "source_id": s1["id"],
                    "title": f"Article {i}",
                    "url": f"https://alpha.news/page/{i}",
                    "published_at": f"2026-10-27T0{i}:00:00Z",
                },
            )

        # Page 1: limit=3, offset=0
        p1 = client.get("/api/articles?limit=3&offset=0")
        assert p1.status_code == 200
        assert len(p1.json()) == 3

        # Page 2: limit=3, offset=3
        p2 = client.get("/api/articles?limit=3&offset=3")
        assert p2.status_code == 200
        assert len(p2.json()) == 3

        # Verify page 1 and page 2 have no overlapping IDs
        p1_ids = {a["id"] for a in p1.json()}
        p2_ids = {a["id"] for a in p2.json()}
        assert p1_ids.isdisjoint(p2_ids)

        # Page 3: limit=3, offset=6 (remaining 1 item)
        p3 = client.get("/api/articles?limit=3&offset=6")
        assert p3.status_code == 200
        assert len(p3.json()) == 1

    def test_api_v1_and_api_prefix_parity(self, client: TestClient, setup_sources):
        """Endpoints are accessible via both /api and /api/v1 prefixes."""
        s1, _ = setup_sources

        # Check sources on both prefixes
        res_sources_v1 = client.get("/api/v1/sources")
        res_sources_std = client.get("/api/sources")
        assert res_sources_v1.status_code == 200
        assert res_sources_std.status_code == 200
        assert res_sources_v1.json() == res_sources_std.json()

        # Check articles on both prefixes
        res_articles_v1 = client.get("/api/v1/articles")
        res_articles_std = client.get("/api/articles")
        assert res_articles_v1.status_code == 200
        assert res_articles_std.status_code == 200
        assert res_articles_v1.json() == res_articles_std.json()
