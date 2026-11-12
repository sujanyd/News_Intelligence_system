# Deferred Infrastructure Tasks — 12 November 2026

**Project**: Multi-Source News Intelligence System  
**Date**: 12 November 2026  
**Status**: Explicitly Deferred to 13 November 2026  

---

## Overview

In accordance with project scheduling and milestone planning for 12 November 2026, the following three infrastructure and deployment tasks were deliberately excluded from today's implementation scope:

1. **PostgreSQL Production Deployment and Live Verification**
2. **Persistent Qdrant Storage Configuration and Restart Verification**
3. **Automated Continuous RSS Ingestion Background Scheduling**

These tasks are reserved for execution tomorrow (13 November 2026). During today's development and verification:
- SQLite (`news_bias.db`) remains the active local relational database.
- Qdrant in-memory mode (`:memory:`) remains the active vector database.
- RSS ingestion is executed on-demand via the `/api/ingestion/run` endpoint and UI button.

---

## 1. Task 1: PostgreSQL Deployment and Live Verification

### Status Today
- **ORM & Dialect Support**: All 21 SQLAlchemy ORM models and Alembic database migrations are written to support standard relational operations across both SQLite and PostgreSQL dialects (e.g. using timezone-aware UTC `DateTime`, indexed foreign keys with cascading deletions, and standard column constraints).
- **Configuration**: `.env` currently uses `DATABASE_URL="sqlite:///./news_bias.db"` for deterministic local demo execution.

### Plan for Tomorrow (13 November 2026)
1. Verify local or Docker-backed PostgreSQL service availability on port `5432`.
2. Configure `.env` with `DATABASE_URL="postgresql+psycopg://postgres:<PASSWORD>@localhost:5432/news_bias_db"`.
3. Execute database migration/initialization script to ensure all 21 tables are created and seeded:
   - `news_sources`, `stories`, `events`, `articles`
   - `article_embeddings`, `article_matches`
   - `article_analyses`, `analysis_topics`, `analysis_facts`, `analysis_quotes`, `analysis_framing_signals`
   - `entities`, `entity_aliases`, `analysis_entities`
   - `news_comparisons`, `comparison_articles`, `comparison_evidence`, `comparison_coverage`, `comparison_political_signals`
   - `ai_detection_results`, `reports`
4. Verify table integrity, foreign keys, and indexes under PostgreSQL.
5. Perform live CRUD verification through FastAPI endpoints against PostgreSQL.

---

## 2. Task 2: Persistent Qdrant Deployment and Restart Verification

### Status Today
- **Service Implementation**: `VectorDatabaseService` (`app/services/vector_db.py`) contains full support for disk persistence via `path` (e.g. `QDRANT_PATH="./qdrant_data"` or file path in `QDRANT_URL`), in addition to remote HTTP/gRPC host configurations.
- **Current Mode**: For today's feature implementation and non-blocking verification, `QDRANT_URL=":memory:"` is active.

### Plan for Tomorrow (13 November 2026)
1. Configure `.env` with `QDRANT_URL=""` and `QDRANT_PATH="./qdrant_data"` to activate disk-backed embedded Qdrant storage.
2. Initialize and verify vector storage with 384-dimensional vectors from `all-MiniLM-L6-v2`.
3. Perform server restart verification:
   - Store test article vectors into collection `article_embeddings`.
   - Shut down FastAPI process.
   - Restart FastAPI process and verify that vectors persist and remain retrievable without data loss.
4. Verify dimension mismatch safety logic and collection recovery policies.

---

## 3. Task 3: Automated Continuous RSS Ingestion Scheduling

### Status Today
- **Pipeline Implementation**: `app/services/rss_ingestion.py` provides complete feed parsing, rate limiting, retry backoff, article deduplication, and database insertion.
- **Trigger**: Manual trigger via `POST /api/ingestion/run` and the frontend "Collect News" button.

### Plan for Tomorrow (13 November 2026)
1. Implement a background task scheduler (e.g., using `APScheduler` or FastAPI background workers).
2. Add environment configuration variables for polling intervals (e.g. `RSS_POLL_INTERVAL_MINUTES=60`).
3. Ensure periodic feed fetching runs asynchronously without blocking API request threads.
4. Incorporate lock mechanisms to prevent concurrent duplicate ingestion runs.
5. Log automated ingestion batches with elapsed time, articles processed, and duplicate counts.

