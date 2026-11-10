# Multi-Source News Intelligence System — API Documentation (v1)

This document provides complete, canonical documentation for the REST API of the Multi-Source News Intelligence System backend at the **90% Milestone**.

---

## 1. Overview & General Conventions

- **Base URL**: `/api/v1` (with automatic backward-compatible aliases at `/api` for primary endpoints)
- **Content-Type**: `application/json`
- **Authentication**: Public in local demo mode; optional bearer JWT for management endpoints.
- **Error Format**:
  ```json
  {
    "detail": "Description of the error condition"
  }
  ```

---

## 2. Ingestion & Sources

### `GET /api/v1/sources`
- **Description**: List all configured news sources (RSS feeds, scrapers, APIs).
- **Query Parameters**:
  - `is_active` (boolean, optional): Filter by active status.
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "name": "The Hindu",
      "slug": "the-hindu",
      "url": "https://www.thehindu.com",
      "feed_url": "https://www.thehindu.com/news/national/feeder/default.rss",
      "is_active": true,
      "created_at": "2026-11-10T12:00:00Z"
    }
  ]
  ```

### `POST /api/v1/sources`
- **Description**: Register a new news source.
- **Request Body**:
  ```json
  {
    "name": "Indian Express",
    "slug": "indian-express",
    "url": "https://indianexpress.com",
    "feed_url": "https://indianexpress.com/feed/",
    "is_active": true
  }
  ```

### `POST /api/v1/sources/ingest`
- **Description**: Trigger RSS feed ingestion across all active news sources.
- **Query Parameters**:
  - `source_id` (integer, optional): Ingest from a single source.
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "ingested_count": 14,
    "duplicates_skipped": 6,
    "errors": []
  }
  ```

---

## 3. Articles

### `GET /api/v1/articles`
- **Description**: Paginated list of ingested news articles.
- **Query Parameters**:
  - `page` (int, default: 1)
  - `page_size` (int, default: 20)
  - `source_id` (int, optional)
  - `story_id` (int, optional)
- **Response (200 OK)**:
  ```json
  {
    "items": [
      {
        "id": 101,
        "source_id": 1,
        "title": "Parliament passes landmark energy transition bill",
        "url": "https://example.com/parliament-bill",
        "published_at": "2026-11-10T08:00:00Z",
        "has_embedding": true
      }
    ],
    "total": 140,
    "page": 1,
    "page_size": 20
  }
  ```

### `GET /api/v1/articles/{article_id}`
- **Description**: Fetch full article details including extracted content.

---

## 4. Extraction & Semantic Analysis

### `POST /api/v1/articles/{article_id}/analyze`
- **Description**: Execute NLP extraction pipeline on an article (topics, entities, facts, quotes, tone, framing).
- **Response (200 OK)**:
  ```json
  {
    "analysis_id": 45,
    "article_id": 101,
    "overall_tone": "neutral",
    "tone_confidence": 0.88,
    "headline_framing": "policy_process",
    "topics_count": 3,
    "entities_count": 5,
    "facts_count": 6,
    "quotes_count": 2,
    "framing_signals_count": 2
  }
  ```

### `GET /api/v1/articles/{article_id}/analysis`
- **Description**: Retrieve previously computed comprehensive analysis for an article.

### `GET /api/v1/articles/{article_id}/topics`
- **Description**: Retrieve extracted topics for the article.

### `GET /api/v1/articles/{article_id}/entities`
- **Description**: Retrieve extracted entities (People, Organizations, Locations) and their article-specific roles.

### `GET /api/v1/articles/{article_id}/facts`
- **Description**: Retrieve extracted factual statements with source paragraph offset evidence.

### `GET /api/v1/articles/{article_id}/quotes`
- **Description**: Retrieve direct quotes, speaker attribution, and source text snippets.

### `GET /api/v1/articles/{article_id}/framing`
- **Description**: Retrieve article tone, headline framing, and specific framing signals with verbatim text evidence.

---

## 5. Political Signal Analysis

### `GET /api/v1/articles/{article_id}/political-signals`
- **Description**: Retrieve political entities and presentation signals (favorable, critical, balanced) detected in an article.
- **Response (200 OK)**:
  ```json
  [
    {
      "entity_name": "Ministry of Power",
      "entity_type": "political_organization",
      "presentation": "favorable",
      "confidence": 0.82,
      "evidence_text": "The Ministry expedited the grid integration ahead of the target deadline."
    }
  ]
  ```

---

## 6. Article Matching & Comparisons

### `POST /api/v1/matching/find-matches`
- **Description**: Discover matches for an article based on semantic vector similarity and entity overlap.
- **Request Body**:
  ```json
  {
    "article_id": 101,
    "threshold": 0.75,
    "relationship_type": "SAME_EVENT"
  }
  ```

### `POST /api/v1/comparisons`
- **Description**: Create a multi-article comparative analysis.
- **Request Body**:
  ```json
  {
    "article_ids": [101, 102, 103],
    "title": "Cross-Publisher Coverage of Energy Transition Bill"
  }
  ```

### `GET /api/v1/comparisons/{comparison_id}`
- **Description**: Retrieve comparative coverage matrix, framing variance, omitted facts, and political presentation signals across publishers.

---

## 7. AI-Generated News Detection (New in Milestone 90)

### `GET /api/v1/articles/{article_id}/ai-detection`
- **Description**: Retrieve cached statistical AI-generated news detection results for an article.
- **Response (200 OK)**:
  ```json
  {
    "id": 12,
    "article_id": 101,
    "is_likely_ai": false,
    "confidence": 0.18,
    "signals": {
      "burstiness_score": 0.62,
      "lexical_diversity": 0.58,
      "repetition_index": 0.08,
      "sentence_count": 28,
      "avg_sentence_len": 18.4,
      "std_sentence_len": 11.41
    },
    "reasoning": "High sentence length variance (burstiness 0.62) and healthy lexical diversity (0.58) reflect natural human journalistic writing pacing.",
    "model_version": "heuristic-burstiness-v1",
    "flagged_for_review": false,
    "review_status": "none",
    "disclaimer": "This score is an empirical likelihood estimate based on statistical text modeling and burstiness variance. It does not provide absolute factual certainty.",
    "created_at": "2026-11-10T18:20:00Z"
  }
  ```

### `POST /api/v1/articles/{article_id}/ai-detection/analyze`
- **Description**: Compute (or recompute) AI likelihood estimate for an article using statistical burstiness heuristics.
- **Request Body** (optional):
  ```json
  {
    "force_reanalyze": true
  }
  ```

### `GET /api/v1/articles/ai-detection/flagged`
- **Description**: Retrieve articles flagged for human editorial verification due to high AI probability ($confidence \ge 0.70$).
- **Query Parameters**:
  - `limit` (int, default: 50)
  - `offset` (int, default: 0)

---

## 8. Reports & Exports

### `POST /api/v1/reports`
- **Description**: Generate an evidence-backed intelligence report (markdown, html, or json).
- **Request Body**:
  ```json
  {
    "report_type": "comparison",
    "target_id": 14,
    "format": "markdown"
  }
  ```

### `GET /api/v1/reports/{report_id}`
- **Description**: Retrieve rendered report content and metadata.

### `GET /api/v1/reports/{report_id}/download`
- **Description**: Download report file in requested format (`.md`, `.html`, `.json`).

---

## 9. Stories & Events

### `GET /api/v1/stories`
- **Description**: High-level narrative arcs grouping evolving events.

### `GET /api/v1/events`
- **Description**: Concrete real-world occurrences grouping articles from multiple publishers.
