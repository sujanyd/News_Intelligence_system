# Backend Architecture & System Audit

This document provides a technical audit of the **News Bias and Framing Analysis System** backend architecture, database schema, service layer, API design, and automated test coverage.

---

## 1. Directory Structure

```text
app/
├── api/
│   └── routes/
│       ├── __init__.py
│       ├── articles.py          # Article CRUD, embeddings, similar search, matching
│       ├── health.py            # System healthcheck & DB connectivity
│       ├── ingestion.py         # Source ingestion triggers and run status
│       └── sources.py           # News source feed management
├── core/
│   ├── __init__.py
│   ├── config.py            # Pydantic v2 Settings (env parsing & defaults)
│   ├── database.py          # SQLAlchemy engine, session maker, SQLite/Postgres dialect handling
│   ├── errors.py            # Custom exceptions & global HTTP handlers
│   └── logging.py           # Structured logging configuration
├── db/
│   ├── __init__.py
│   ├── base.py              # Declarative base & dynamic schema exports
│   └── models/              # Normalized SQLAlchemy models (21 tables)
│       ├── article.py
│       ├── article_embedding.py
│       ├── article_match.py
│       ├── article_metrics.py
│       ├── article_sentiment.py
│       ├── bias_assessment.py
│       ├── cluster_article.py
│       ├── cluster.py
│       ├── entity_mention.py
│       ├── entity.py
│       ├── framing_signal.py
│       ├── ideological_bias.py
│       ├── news_source.py
│       ├── quotation.py
│       ├── raw_feed_item.py
│       ├── source_credibility.py
│       ├── story_event.py
│       ├── story.py
│       └── topic.py
├── schemas/                 # Pydantic request/response validation schemas
│   ├── article.py
│   ├── embedding.py
│   ├── match.py
│   ├── news_source.py
│   └── similarity.py
├── services/                # Encapsulated business logic
│   ├── article_service.py       # Article querying & persistence
│   ├── deduplication_service.py # Canonical URL normalization & hash deduplication
│   ├── embedding_service.py     # Vector generation (Mock, OpenAI, Gemini)
│   ├── matching_service.py      # Multi-signal pairwise classification (SAME, RELATED, DIFFERENT)
│   ├── preprocessing_service.py # HTML stripping, Unicode normalization, whitespace clean
│   ├── rss_service.py           # Feedparser wrapper with resilience & retries
│   ├── vector_search_service.py # High-level semantic similarity orchestration
│   └── vector_service.py        # Qdrant client abstraction (collections, upsert, search)
└── main.py                  # FastAPI application entrypoint, middleware, routers
```

---

## 2. Database Models & Schema Summary

The database currently defines **21 relational tables** mapped with SQLAlchemy 2.0.

### Core Implemented Models (Live & Populated in Ingestion/Matching)

| Model Name | Table Name | Purpose | Primary Fields |
|---|---|---|---|
| `NewsSource` | `news_sources` | Registered publisher RSS feeds | `id`, `name`, `slug`, `website_url`, `feed_url`, `bias_rating`, `is_active` |
| `Article` | `articles` | Normalized scraped articles | `id`, `source_id`, `title`, `url`, `canonical_url`, `content_hash`, `published_at` |
| `RawFeedItem` | `raw_feed_items` | Audit log of raw parsed RSS payloads | `id`, `source_id`, `raw_title`, `raw_url`, `payload`, `fetched_at` |
| `ArticleEmbedding` | `article_embeddings`| Metadata tracking for generated vectors | `id`, `article_id`, `embedding_type`, `model_name`, `vector_id`, `dimensions` |
| `ArticleMatch` | `article_matches` | Pairwise comparison & classification | `id`, `article_a_id`, `article_b_id`, `similarity_score`, `classification`, `signals` |

### Downstream Analysis Models (Schema Ready for Advanced Phases)

| Domain | Table Names | Intended Purpose | Status |
|---|---|---|---|
| **Story Clustering** | `stories`, `story_events`, `clusters`, `cluster_articles` | Multi-source event aggregation | Models defined, clustering engine next phase |
| **Entities & Topics** | `entities`, `entity_mentions`, `topics`, `quotations` | NER, quotation extraction | Models defined |
| **Sentiment & Tone** | `article_sentiments`, `article_metrics` | Polarity, subjectivity, readability scores | Models defined |
| **Bias & Framing** | `bias_assessments`, `framing_signals`, `ideological_biases`, `source_credibility` | Multi-dimensional bias metrics | Models defined |

---

## 3. Service Layer Architecture

### 3.1. Ingestion & Preprocessing
- **`rss_service.py`**: Fetches RSS/Atom feeds using `feedparser`, incorporates retries with backoff, user-agent spoofing, and error resilience.
- **`deduplication_service.py`**: Strips query tracking parameters (UTM tags, session identifiers), normalizes URL protocols and lowercase hostnames, and calculates SHA-256 hashes of cleaned title + body for rapid O(1) duplicate rejection.
- **`preprocessing_service.py`**: Strips markup, handles Unicode normalization (NFKC), collapses redundant whitespace, and produces consistent plaintext representation for embedding models.

### 3.2. Semantic Embedding Generation
- **`embedding_service.py`**: Supports swappable providers (`mock`, `openai`, `gemini`) via configuration.
  - Generates deterministic 384-dimensional unit vectors in `mock` mode for offline demo reliability and automated testing without API costs or rate-limiting.
  - Supports separate embedding types: `HEADLINE` and `BODY`.
  - Produces consistent `ArticleEmbedding` records in PostgreSQL/SQLite.

### 3.3. Vector Storage & Nearest-Neighbor Search
- **`vector_service.py`**: Manages collection lifecycle in Qdrant (auto-creates collection with Cosine distance). In-memory mode (`:memory:`) provides zero-dependency deployment, while HTTP connects to standard Qdrant containers.
- **`vector_search_service.py`**: Orchestrates vector search, automatically excludes query article self-matches (`must_not: id == query_id`), filters candidates by cosine threshold (default 0.70), and enriches vector payload results with relational article metadata.

### 3.4. Multi-Signal Pairwise Matching & Classification
- **`matching_service.py`**:
  - Compares candidate article pairs discovered via vector search.
  - Normalizes pair order (`article_a_id < article_b_id`) to ensure unique bidirectional constraints.
  - Evaluates multi-signal criteria:
    - **Vector Cosine Similarity** (Headline & Body)
    - **Temporal Proximity** (Publication timestamps within 24–48 hours)
    - **Lexical Overlap / Jaccard Token Overlap**
    - **Publisher Diversity** (Different sources favored for cross-media comparisons)
  - Classifies pairs into three discrete tiers:
    - `SAME`: High semantic similarity (>0.85) + overlapping key tokens reporting the identical real-time event.
    - `RELATED`: Moderate similarity (0.70–0.85) or shared topic within the same domain.
    - `DIFFERENT`: Dissimilar content or distinct events (<0.70).
  - Persists matches to `article_matches` table with explanation signals stored in JSON.

---

## 4. API Endpoint Summary

FastAPI routes are mounted at both `/api` and `/api/v1` for frontend compatibility:

| HTTP Method | Path | Description | Parameters / Payload |
|---|---|---|---|
| `GET` | `/health` / `/api/health` | Service and database health check | None |
| `GET` | `/api/sources` | List configured news sources | `skip`, `limit`, `active_only` |
| `POST` | `/api/sources` | Register a new RSS news source | `{ name, slug, website_url, feed_url }` |
| `POST` | `/api/ingestion/run` | Trigger RSS feed ingestion run | `{ source_id (optional) }` |
| `GET` | `/api/articles` | List ingested news articles | `skip`, `limit`, `source_id` |
| `GET` | `/api/articles/{id}` | Get full article details | Path parameter `id` |
| `POST` | `/api/articles/{id}/embeddings` | Generate & store headline/body vectors | None |
| `GET` | `/api/articles/{id}/similar` | Retrieve top-K similar articles via Qdrant | `limit` (default 5), `score_threshold` (0.7) |
| `GET` | `/api/articles/{id}/matches` | Get classified pairs (`SAME`, `RELATED`, `DIFFERENT`)| None |
| `POST` | `/api/articles/{id}/match` | Execute live comparison against candidates | None |

---

## 5. Automated Test Suite Verification

The test suite is structured under `tests/` and runs with `pytest`:

```bash
.venv/bin/pytest tests/ -v
```

### Results Summary
- **Total Test Cases:** 132
- **Passed:** 131
- **Skipped:** 1 (`test_docker_postgres_running` — skipped gracefully when Docker is not active)
- **Failed:** 0
- **Execution Time:** ~4.9 seconds

### Test Coverage Highlights
- `tests/test_api_articles.py`: Tests article retrieval, pagination, and not-found responses.
- `tests/test_api_ingestion.py`: Tests feed scraping triggers and job execution.
- `tests/test_deduplication.py`: Verifies URL parameter cleaning and content hash collision avoidance.
- `tests/test_embeddings.py`: Validates vector generation across different embedding types and providers.
- `tests/test_vector_service.py`: Tests Qdrant collection initialization, vector insertion, and vector similarity retrieval.
- `tests/test_matching_service.py`: Validates pairwise classification logic (`SAME`, `RELATED`, `DIFFERENT`) and canonical ordering.

