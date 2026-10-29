# News Bias and Framing Analysis System

A modern, scalable system built with **FastAPI**, **PostgreSQL**, **Qdrant**, and **React** to analyze news articles for political bias, sentiment framing, narrative divergence, and coverage disparity across media publishers.

---

## 📌 1. Project Overview

The **News Bias and Framing Analysis System** is designed to help readers and researchers understand how different media outlets report on the same events. By analyzing news text, headlines, and tone, the system identifies:
- **Political Bias**: Leaning and ideological slant across news publishers.
- **Framing & Narrative Tactics**: Emphasis on particular perspectives (e.g., economic vs. humanitarian framing).
- **Sentiment & Tone**: Objective reporting vs. emotionally charged language.
- **Coverage Comparison**: Cross-publisher comparison identifying reporting volume, omitted facts, and tone discrepancies.
- **AI Detection Metadata**: Probabilistic machine-generated text likelihood tracking.
- **Vector Search & Embedding Integration**: Hybrid architecture storing dense vectors in Qdrant and relational metadata in PostgreSQL.

This repository hosts the backend REST API, PostgreSQL database layer, data models, analysis services, and interactive frontend.

---

## 🛠️ 2. Technology Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High-performance Python web framework)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/) (Lightning-fast ASGI web server)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & [Pydantic-Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- **Database ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (Declarative models with session dependency)
- **Database Migrations**: [Alembic](https://alembic.sqlalchemy.org/) (Versioned database schema management)
- **Database Drivers**: [psycopg (v3)](https://www.psycopg.org/psycopg3/) & [psycopg2-binary](https://www.psycopg.org/) (PostgreSQL adapters)
- **Vector Store Integration**: [Qdrant](https://qdrant.tech/) (High-dimensional vector embeddings and similarity search)
- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vite.dev/) (Single-page web dashboard)
- **Testing**: [pytest](https://docs.pytest.org/) & [HTTPX](https://www.python-httpx.org/) (Automated backend testing)
- **Version Control**: Git & GitHub

---

## 📂 3. Project Directory Structure

```text
news_intellegence_AP_project/
├── alembic/                             # Database migration management
│   ├── env.py                           # Migration environment configured with app settings
│   ├── script.py.mako                   # Migration template
│   └── versions/                        # Versioned migration scripts
│       ├── 0001_initial_core_tables.py
│       └── 0002_remaining_tables_and_constraints.py
│
├── app/
│   ├── __init__.py                      # Marks app as a Python package
│   ├── main.py                          # Application entry point & FastAPI instance
│   │
│   ├── api/                             # API routing layer
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py                # Central v1 router combining all sub-routers
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── health.py            # Health-check endpoint (GET /health)
│   │           ├── sources.py           # News sources endpoints (GET, POST /api/sources)
│   │           └── articles.py          # Articles endpoints (GET, POST /api/articles)
│   │
│   ├── core/                            # Application configuration
│   │   ├── __init__.py
│   │   └── config.py                    # Environment settings loaded via Pydantic
│   │
│   ├── db/                              # Database integration
│   │   ├── __init__.py
│   │   ├── base.py                      # DeclarativeBase for models
│   │   ├── session.py                   # Engine creation & get_db session dependency
│   │   ├── init_db.py                   # Reproducible table creation script
│   │   └── seed.py                      # Sample data seeding script across all 21 tables
│   │
│   ├── models/                          # SQLAlchemy ORM database models (21 tables)
│   │   ├── __init__.py                  # Exports all 21 models for Alembic discovery
│   │   ├── news_source.py               # NEWS_SOURCE table model
│   │   ├── story.py                     # STORY table model
│   │   ├── event.py                     # EVENT table model
│   │   ├── article.py                   # ARTICLE table model
│   │   ├── article_embedding.py         # ARTICLE_EMBEDDING table model
│   │   ├── article_match.py             # ARTICLE_MATCH table model
│   │   ├── article_analysis.py          # ARTICLE_ANALYSIS table model
│   │   ├── analysis_topic.py            # ANALYSIS_TOPIC table model
│   │   ├── analysis_fact.py             # ANALYSIS_FACT table model
│   │   ├── analysis_quote.py            # ANALYSIS_QUOTE table model
│   │   ├── analysis_framing_signal.py   # ANALYSIS_FRAMING_SIGNAL table model
│   │   ├── entity.py                    # ENTITY table model
│   │   ├── entity_alias.py              # ENTITY_ALIAS table model
│   │   ├── analysis_entity.py           # ANALYSIS_ENTITY table model
│   │   ├── news_comparison.py           # NEWS_COMPARISON table model
│   │   ├── comparison_article.py        # COMPARISON_ARTICLE table model
│   │   ├── comparison_evidence.py       # COMPARISON_EVIDENCE table model
│   │   ├── comparison_coverage.py       # COMPARISON_COVERAGE table model
│   │   ├── comparison_political_signal.py # COMPARISON_POLITICAL_SIGNAL table model
│   │   ├── ai_detection_result.py       # AI_DETECTION_RESULT table model
│   │   └── report.py                    # REPORT table model
│   │
│   ├── schemas/                         # Pydantic schemas (request/response validation)
│   │   ├── __init__.py                  # Exports all validation models
│   │   ├── health.py                    # HealthCheckResponse schema
│   │   ├── news_source.py               # NewsSourceBase, Create, Response schemas
│   │   └── article.py                   # ArticleCreate, SummaryResponse, DetailResponse schemas
│   │
│   └── services/                        # Business logic & analysis algorithms
│       └── __init__.py                  # News scraping, bias classification, framing logic
│
├── frontend/                            # React + Vite frontend user interface
│   ├── src/                             # Source files (components, pages, api, styles, tests)
│   ├── .env.example                     # Frontend environment template (VITE_API_BASE_URL)
│   ├── package.json                     # Frontend dependencies and scripts
│   └── README.md                        # Frontend setup and documentation
│
├── tests/                               # Automated test suite
│   ├── __init__.py
│   ├── conftest.py                      # Pytest fixtures (TestClient, DB session, foreign key pragma)
│   ├── test_health.py                   # Health-check endpoint unit tests
│   ├── test_database.py                 # Comprehensive database models & constraint tests
│   └── test_api_endpoints.py            # News sources and articles API endpoint tests
│
├── .env.example                         # Template for required environment variables
├── .gitignore                           # Excludes virtual envs, secrets, and cache files
├── alembic.ini                          # Alembic configuration file
├── docker-compose.yml                   # PostgreSQL container setup for local development
├── requirements.txt                     # Python project dependencies
└── README.md                            # Project documentation & setup instructions
```

---

## 🗄️ 4. Complete Database Schema & Architectural Design

The database schema is organized into 21 specialized tables across 6 functional domains:

```mermaid
erDiagram
    NEWS_SOURCE ||--o{ ARTICLE : publishes
    STORY ||--o{ EVENT : contains
    EVENT ||--o{ ARTICLE : reported_by
    EVENT ||--o{ NEWS_COMPARISON : groups

    ARTICLE ||--o{ ARTICLE_EMBEDDING : has
    ARTICLE ||--o{ ARTICLE_ANALYSIS : evaluated_in
    ARTICLE ||--o{ AI_DETECTION_RESULT : scored_by
    ARTICLE ||--o{ COMPARISON_ARTICLE : participates_in
    ARTICLE ||--o{ ARTICLE : duplicate_of

    ARTICLE_ANALYSIS ||--o{ ANALYSIS_TOPIC : extracts
    ARTICLE_ANALYSIS ||--o{ ANALYSIS_FACT : extracts
    ARTICLE_ANALYSIS ||--o{ ANALYSIS_QUOTE : extracts
    ARTICLE_ANALYSIS ||--o{ ANALYSIS_FRAMING_SIGNAL : detects
    ARTICLE_ANALYSIS ||--o{ ANALYSIS_ENTITY : mentions

    ENTITY ||--o{ ENTITY_ALIAS : has
    ENTITY ||--o{ ANALYSIS_ENTITY : referenced_by

    NEWS_COMPARISON ||--o{ COMPARISON_ARTICLE : includes
    NEWS_COMPARISON ||--o{ COMPARISON_EVIDENCE : documents
    NEWS_COMPARISON ||--o{ COMPARISON_COVERAGE : measures
    NEWS_COMPARISON ||--o{ COMPARISON_POLITICAL_SIGNAL : assesses
    NEWS_COMPARISON ||--o{ REPORT : produces
```

### Table Inventory & Purpose (21 Tables)

| # | Table Name | Purpose | Key Relationships & Constraints |
|---|------------|---------|---------------------------------|
| 1 | `news_sources` | Media organizations & publishers (e.g., Reuters, BBC, AP). | One-to-many with `articles`. Unique `name`. |
| 2 | `stories` | High-level overarching news narratives (e.g., '2026 UN Climate Summit'). | One-to-many with `events`. |
| 3 | `events` | Specific real-world occurrences tied to a story with independent incident timestamps. | Belongs to `stories`. Linked to `articles` and `news_comparisons`. |
| 4 | `articles` | Ingested news articles with distinct publication and retrieval timestamps. | FK to `news_sources`, nullable FK to `events`. Self-referencing FK `duplicate_of_article_id`. Check constraint on `content_availability`. |
| 5 | `article_embeddings` | Embedding metadata and vector point references in Qdrant (vectors stored in Qdrant). | FK to `articles` (CASCADE). Unique constraint on `(article_id, embedding_type, model_name)`. |
| 6 | `article_matches` | Pairwise article relationships (`SAME`, `RELATED`, `DIFFERENT`) and similarity scores. | FK to `articles` on both sides. Check constraint `article_id_1 < article_id_2` ensures canonical ordering, prevents self-matches, and enforces unordered pair uniqueness. |
| 7 | `article_analyses` | Analytical run metadata, bias scores, sentiment scores, and confidence levels. | FK to `articles` (CASCADE). One-to-many with evidence tables. Supports multiple pipeline runs. |
| 8 | `analysis_topics` | Detected topics with relevance scores and character boundary positions. | FK to `article_analyses` (CASCADE). Check constraint `start_char <= end_char`. |
| 9 | `analysis_facts` | Extracted factual claims, verification status, and character boundaries. | FK to `article_analyses` (CASCADE). Check constraint `start_char <= end_char`. |
| 10 | `analysis_quotes` | Extracted quotations distinguishing quoted speaker opinions from publisher narration. | FK to `article_analyses` (CASCADE). Check constraint on `source_type IN ('speaker_opinion', 'publisher_narration')`. |
| 11 | `analysis_framing_signals` | Rhetorical framing devices (e.g., economic, humanitarian, conflict) with intensity scores. | FK to `article_analyses` (CASCADE). Check constraint `start_char <= end_char`. |
| 12 | `entities` | Canonical named entities (people, organizations, locations, concepts). | Unique `name`. One-to-many with `entity_aliases` and `analysis_entities`. |
| 13 | `entity_aliases` | Variant names, acronyms, and aliases for entities. | FK to `entities` (CASCADE). Unique constraint on `(entity_id, alias)`. |
| 14 | `analysis_entities` | Mentions of entities in an analysis with frequency, sentiment, and salience scores. | FK to `article_analyses` and `entities`. Unique constraint on `(analysis_id, entity_id)`. |
| 15 | `news_comparisons` | Comparative analysis sessions across multiple articles covering an event. | Nullable FK to `events`. One-to-many with comparison details and reports. |
| 16 | `comparison_articles` | Junction linking articles to comparisons. Serves as target for composite foreign keys. | FK to `news_comparisons` and `articles`. Unique constraint on `(comparison_id, article_id)`. |
| 17 | `comparison_evidences` | Granular contrast evidence (framing differences, tone divergence, selective omissions). | Composite FK `(comparison_id, article_id)` to `comparison_articles` guarantees article belongs to comparison. |
| 18 | `comparison_coverages` | Per-article coverage metrics (depth, tone score, primary frame, omitted topics). | Composite FK `(comparison_id, article_id)` to `comparison_articles`. Unique on `(comparison_id, article_id)`. |
| 19 | `comparison_political_signals` | Ideological leanings, slant scores, and partisanship indicators per article in comparison. | Composite FK `(comparison_id, article_id)` to `comparison_articles`. Unique on `(comparison_id, article_id)`. |
| 20 | `ai_detection_results` | Probabilistic AI-generated text likelihood and detector model metadata. | FK to `articles` (CASCADE). Check constraint `ai_likelihood BETWEEN 0.0 AND 1.0`. Likelihood is statistical estimate, not conclusive proof. |
| 21 | `reports` | Synthesized intelligence reports generated from a comparison session. | FK to `news_comparisons` (CASCADE). Markdown/HTML content formats. |

### Important Architectural & Database Rules

1. **Decoupled Timestamps**:
   - `EVENT.event_time`: Real-world occurrence time.
   - `ARTICLE.published_at`: When the outlet published their report.
   - `ARTICLE.retrieved_at`: When our scraping pipeline ingested the article.
   - `ARTICLE.created_at`: When the database record was inserted.
   - Enables timeline discrepancy detection, reporting lag analysis, and historical auditing.

2. **Qdrant Vector Database Integration**:
   - High-dimensional dense vectors (e.g. 1536-d text embeddings) reside in **Qdrant** for ANN vector search.
   - PostgreSQL stores relational metadata, embedding type (`title`, `content`, `summary`), model name, and the Qdrant `vector_reference` point key.

3. **Canonical Pair Ordering in Article Matching**:
   - `ARTICLE_MATCH` enforces `article_id_1 < article_id_2` via check constraint.
   - Automatically prevents an article from being matched against itself (`article_id_1 == article_id_2`).
   - Combined with `UniqueConstraint("article_id_1", "article_id_2")`, each unordered pair `{A, B}` is stored exactly once in canonical order.

4. **Speaker Opinion vs. Publisher Narration**:
   - `ANALYSIS_QUOTE` strictly distinguishes external quoted statements from editorial narrative voice using `source_type IN ('speaker_opinion', 'publisher_narration')` and `is_opinion`.

5. **Composite Foreign Key Integrity on Comparisons**:
   - Detailed comparison tables (`comparison_evidences`, `comparison_coverages`, `comparison_political_signals`) reference `(comparison_id, article_id)` in `comparison_articles`.
   - Guarantees at the database engine level that no comparison detail can reference an article outside that comparison session.

6. **Probabilistic AI Detection**:
   - `AI_DETECTION_RESULT` records statistical perplexity/burstiness estimates (`ai_likelihood BETWEEN 0.0 AND 1.0`).
   - Explicitly treated as a probabilistic indicator for human review, not proof of machine generation.

---

## 🔍 5. Purpose of Important Files Explained

| File / Folder | Purpose in Simple Terms |
| :--- | :--- |
| `app/main.py` | The starting point of the backend. It creates the FastAPI app, configures CORS middleware, mounts routers at `/api` and `/api/v1`, and defines root/health routes. |
| `app/core/config.py` | Reads settings from your `.env` file (like database URL and app name) and makes them safely accessible with default values. |
| `app/models/` | Contains all 21 SQLAlchemy ORM models defining tables, relationships, check constraints, and composite foreign keys. |
| `app/schemas/` | Pydantic v2 schemas validating request payloads and structuring serialized API responses. |
| `app/api/v1/endpoints/sources.py` | REST API router for news sources (`GET /api/sources`, `GET /api/sources/{id}`, `POST /api/sources`). |
| `app/api/v1/endpoints/articles.py` | REST API router for articles (`GET /api/articles` with pagination and source filtering, `GET /api/articles/{id}`, `POST /api/articles`). |
| `app/api/v1/endpoints/ingestion.py` | REST API router for RSS ingestion (`POST /api/ingestion/run`, `GET /api/ingestion/feeds`). |
| `app/services/rss_ingestion.py` | RSS ingestion engine: fetches feeds, normalizes URLs, computes SHA-256 hashes, deduplicates, and saves articles to PostgreSQL. |
| `app/schemas/ingestion.py` | Pydantic validation schemas for RSS feed configs, execution requests, and run summary reports. |
| `app/db/session.py` | Prepares the connection to PostgreSQL/SQLite. Provides `get_db()` which gives each API request an isolated database session. |
| `app/db/init_db.py` | Reproducible script to create all 21 database tables in the configured database without needing raw SQL. |
| `app/db/seed.py` | Populates rich sample data across all 21 tables (Sources, Articles, Embeddings, Analyses, Entities, Comparisons, and Reports). |
| `alembic/versions/` | Stores version-controlled database migrations (`0001_initial_core_tables` and `0002_remaining_tables_and_constraints`). |
| `docker-compose.yml` | Spins up a local PostgreSQL 16 container with one command. |
| `frontend/` | React + Vite web interface with modular navigation (Dashboard, Articles, Comparisons, Reports) and configurable API client. |
| `tests/test_api_endpoints.py` | Integration tests verifying source and article endpoints, duplicate prevention, pagination, and error handling. |
| `tests/test_database.py` | Comprehensive test suite verifying all 21 tables, foreign keys, unique constraints, check constraints, and relationships. |

---

## 🚀 6. Getting Started (Local Setup)

### Step 1: Clone the Repository

```bash
git clone https://github.com/sujanyd/News_Intelligence_system.git
cd News_Intelligence_system
```

### Step 2: Create and Activate a Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Copy the example environment file to create your local `.env`:

```bash
cp .env.example .env
```

> **Security Note**: The `.env` file is excluded from Git tracking via `.gitignore` to prevent leaking database credentials, passwords, or secret tokens. Always configure local secrets in `.env`.

Settings in `.env`:
```env
# Application Settings
PROJECT_NAME="News Bias and Framing Analysis System"
API_V1_PREFIX="/api/v1"
ENVIRONMENT="development"
DEBUG=True
HOST="0.0.0.0"
PORT=8000

# Database Settings (PostgreSQL)
# Format: postgresql+psycopg://<username>:<password>@<host>:<port>/<database_name>
# If port 5432 is already bound by an existing local service, use POSTGRES_PORT=5433
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgrespassword
POSTGRES_DB=news_bias_db
DATABASE_URL="postgresql+psycopg://postgres:postgrespassword@localhost:5432/news_bias_db"

# Optional SQLite URL for quick local testing without PostgreSQL:
# DATABASE_URL="sqlite:///./news_bias.db"
```

---

## 🐘 7. PostgreSQL Database Setup & Initial Core Models

### How to Create the Database and Configure Connections

You can run PostgreSQL either through Docker (recommended) or via a native system service:

#### Option A: Using Docker (Recommended)

1. Start the PostgreSQL container:
   ```bash
   docker compose up -d
   ```
2. **Port Conflict Note**: If port `5432` is already in use on your host machine (e.g. by a native PostgreSQL installation), set `POSTGRES_PORT=5433` in `.env`. The `docker-compose.yml` automatically maps `${POSTGRES_PORT:-5432}:5432`, allowing you to connect seamlessly via port `5433` without port collisions:
   ```env
   POSTGRES_PORT=5433
   DATABASE_URL="postgresql+psycopg://postgres:postgrespassword@localhost:5433/news_bias_db"
   ```
3. Stop the container when finished:
   ```bash
   docker compose down
   ```

#### Option B: Using Native PostgreSQL (Homebrew / macOS / Linux)

If you have PostgreSQL installed natively:
```bash
# 1. Start the service
brew services start postgresql@16  # On macOS Homebrew
# sudo systemctl start postgresql  # On Ubuntu/Debian

# 2. Create the user and database
createuser -s postgres
createdb -U postgres news_bias_db

# 3. Verify connection
psql -U postgres -d news_bias_db -c "SELECT version();"
```

#### Option C: Quick Local Prototyping with SQLite

If PostgreSQL is temporarily unavailable in your environment:
```env
DATABASE_URL="sqlite:///./news_bias.db"
```

---

### Initial Core Models Architecture

The foundation of the intelligence system models news production across 4 core tables:

```
[ NEWS_SOURCE ] 1 ──< publishes >── N [ ARTICLE ]
                                           │
                                           │ references (0..1)
                                           ▼
[ STORY ] 1 ──< encompasses >── N [ EVENT ]
```

#### 1. `NEWS_SOURCE` Table (`news_sources`)
Represents an editorial organization or media outlet (e.g. Reuters, BBC, AP).
- `id` (`Integer`, Primary Key, Indexed)
- `name` (`String(255)`, Unique, Indexed, Non-nullable): Official publisher name.
- `base_url` (`String(512)`, Non-nullable): Publisher homepage domain.
- `created_at` (`DateTime(timezone=True)`, Non-nullable, Default: `now()`): Record registration timestamp.
- **Relationship**: `articles = relationship("Article", back_populates="source", cascade="all, delete-orphan")` (Deleting a source cascades to its published articles).

#### 2. `STORY` Table (`stories`)
Represents an overarching news narrative, ongoing story, or developing topic (e.g., "2026 UN Climate Summit").
- `id` (`Integer`, Primary Key, Indexed)
- `title` (`String(512)`, Indexed, Non-nullable): Narrative title.
- `created_at` (`DateTime(timezone=True)`, Non-nullable, Default: `now()`): Narrative creation timestamp.
- **Relationship**: `events = relationship("Event", back_populates="story", cascade="all, delete-orphan")`.

#### 3. `EVENT` Table (`events`)
Represents a specific, localized occurrence belonging to a story (e.g., "Signing of Treaty in Geneva on Oct 28").
- `id` (`Integer`, Primary Key, Indexed)
- `story_id` (`Integer`, Foreign Key -> `stories.id` ON DELETE CASCADE, Non-nullable, Indexed)
- `event_time` (`DateTime(timezone=True)`, Nullable): When the real-world occurrence happened.
- `event_time_precision` (`String(50)`, Nullable, Default: `'unknown'`): Indicates timestamp precision (`'exact'`, `'date'`, `'range'`, `'unknown'`).
- `event_time_disagreement` (`Boolean`, Non-nullable, Default: `False`): Flag set to `True` if different reporting outlets dispute the event timeline.
- **Relationships**: `story = relationship("Story", back_populates="events")`, `articles = relationship("Article", back_populates="event")`.

#### 4. `ARTICLE` Table (`articles`)
Represents an individual news report published by a source and optionally linked to a specific event.
- `id` (`Integer`, Primary Key, Indexed)
- `source_id` (`Integer`, Foreign Key -> `news_sources.id` ON DELETE CASCADE, Non-nullable, Indexed)
- `event_id` (`Integer`, Foreign Key -> `events.id` ON DELETE SET NULL, Nullable, Indexed): Nullable so articles can exist before event clustering or if an event is deleted.
- `title` (`String(512)`, Non-nullable): Article headline.
- `content` (`Text`, Non-nullable): Body text of the news report.
- `url` (`String(1024)`, Unique, Indexed, Non-nullable): Canonical URL prevents duplicate ingestion.
- `published_at` (`DateTime(timezone=True)`, Nullable): Outlet's reported publication time.
- `retrieved_at` (`DateTime(timezone=True)`, Non-nullable, Default: `now()`): Ingestion pipeline fetch time.
- `created_at` (`DateTime(timezone=True)`, Non-nullable, Default: `now()`): Database row creation time.
- **Relationships**: `source = relationship("NewsSource", back_populates="articles")`, `event = relationship("Event", back_populates="articles")`.

#### Key Design Decisions Explained

1. **Why `DateTime(timezone=True)` across all timestamps?**
   News reporting is global. Normalizing all datetimes to UTC with explicit timezone offsets eliminates ambiguous daylight-saving shifts and timezone confusion when comparing timelines across international outlets.
2. **Why decouple `event_time`, `published_at`, and `retrieved_at`?**
   - `event_time`: The physical real-world occurrence.
   - `published_at`: When the media outlet published their report (often hours or days after the event).
   - `retrieved_at`: When our scraping pipeline ingested the article.
   - Decoupling these three values enables calculating **reporting lag** and identifying **chronological framing discrepancies**.
3. **Why `event_time_precision` and `event_time_disagreement`?**
   Breaking news often reports approximate dates ("Tuesday morning") or conflicting timelines across opposing news outlets. Modeling precision and disagreement as explicit attributes allows the system to flag disputed facts.
4. **Why `url` is Unique and Indexed?**
   Ensures idempotent data ingestion: re-running feed scrapers cannot accidentally insert duplicate articles.
5. **Foreign Key Cascade Strategies**:
   - `NEWS_SOURCE -> ARTICLE`: `ON DELETE CASCADE` (if a source is purged, its articles are purged).
   - `STORY -> EVENT`: `ON DELETE CASCADE` (if a story narrative is removed, its sub-events are removed).
   - `EVENT -> ARTICLE`: `ON DELETE SET NULL` (deleting an event does **not** destroy the news article; it simply unlinks it for re-clustering).

---

## ⚙️ 8. Running Migrations, Verification & Seeding

### Apply Database Migrations (Alembic)

1. **Apply initial core tables migration (`0001_initial_core_tables`)**:
   ```bash
   alembic upgrade 0001_initial_core_tables
   ```
2. **Apply all migrations up to head**:
   ```bash
   alembic upgrade head
   ```
3. **Inspect current migration revision**:
   ```bash
   alembic current
   ```
4. **Rollback migration**:
   ```bash
   alembic downgrade -1     # Rollback one step
   alembic downgrade base   # Rollback all migrations
   ```

### Run Step-by-Step PostgreSQL Verification Script

A standalone verification script is provided in `scripts/verify_postgres.py` to validate the entire workflow end-to-end:
```bash
python scripts/verify_postgres.py
```
This script automatically:
1. Tests the PostgreSQL live connection and prints the database name and server version.
2. Inserts a sample `NEWS_SOURCE`.
3. Inserts a sample `STORY`.
4. Inserts a sample `EVENT` linked to the story.
5. Inserts a sample `ARTICLE` linked to both the source and the event.
6. Queries the database and verifies bi-directional foreign-key relationships.
7. Verifies the FastAPI `/health` endpoint and cleans up test records.

### Direct Table Creation & Seeding
```bash
# Alternative direct table creation (using SQLAlchemy metadata)
python -m app.db.init_db

# Populate rich sample data
python -m app.db.seed
```

## 💻 9. Running the Server

Start the FastAPI application with live auto-reload enabled:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Once running, you can access:
- **Root Welcome Endpoint**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Health Check Endpoint**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 📡 10. API Endpoints & Usage Guide

The backend exposes RESTful endpoints supporting both `/api` (default frontend prefix) and `/api/v1` (versioned REST standard) prefixes. Interactive API documentation is available at `/docs` (Swagger UI) and `/redoc` (ReDoc).

### News Sources Endpoints

#### 1. List News Sources
- **Route**: `GET /api/sources` (or `GET /api/v1/sources`)
- **Query Parameters**:
  - `limit` *(optional, integer)*: Maximum number of sources to return (1-100).
  - `offset` *(optional, integer)*: Number of sources to skip (default `0`).
- **Response** (`200 OK`):
```json
[
  {
    "id": 1,
    "name": "Reuters",
    "base_url": "https://www.reuters.com",
    "created_at": "2026-10-27T08:00:00Z"
  },
  {
    "id": 2,
    "name": "The Hindu",
    "base_url": "https://www.thehindu.com",
    "created_at": "2026-10-27T08:15:00Z"
  }
]
```

#### 2. Retrieve a News Source
- **Route**: `GET /api/sources/{source_id}`
- **Response** (`200 OK`):
```json
{
  "id": 1,
  "name": "Reuters",
  "base_url": "https://www.reuters.com",
  "created_at": "2026-10-27T08:00:00Z"
}
```
- **Error Response** (`404 Not Found`):
```json
{
  "detail": "News source with ID 99 not found"
}
```

#### 3. Create a News Source
- **Route**: `POST /api/sources`
- **Request Body**:
```json
{
  "name": "Associated Press",
  "base_url": "https://apnews.com"
}
```
- **Response** (`201 Created`):
```json
{
  "id": 3,
  "name": "Associated Press",
  "base_url": "https://apnews.com",
  "created_at": "2026-10-27T09:30:00Z"
}
```
- **Duplicate Name Error** (`409 Conflict`):
```json
{
  "detail": "News source with this name already exists"
}
```

---

### Articles Endpoints

#### 4. List Articles (with Pagination & Source Filtering)
- **Route**: `GET /api/articles`
- **Query Parameters**:
  - `source_id` *(optional, integer)*: Filter articles by publishing source ID.
  - `limit` *(optional, integer, default 50, max 100)*: Number of articles per page.
  - `offset` *(optional, integer, default 0)*: Number of articles to skip.
- **Optimization Note**: Article listings omit the heavy `content` body text to keep network payloads lightweight and fast (Requirement 9).
- **Response** (`200 OK`):
```json
[
  {
    "id": 101,
    "source_id": 1,
    "source_name": "Reuters",
    "event_id": null,
    "title": "Global Leaders Conclude Trade Summit with Landmark Pact",
    "url": "https://www.reuters.com/world/trade-summit-agreement-2026",
    "content_availability": "full_text",
    "published_at": "2026-10-27T06:00:00Z",
    "retrieved_at": "2026-10-27T06:30:00Z",
    "created_at": "2026-10-27T06:30:00Z"
  }
]
```

#### 5. Retrieve an Article by ID
- **Route**: `GET /api/articles/{article_id}`
- **Response** (`200 OK`, includes full content and deduplication metadata):
```json
{
  "id": 101,
  "source_id": 1,
  "source_name": "Reuters",
  "event_id": null,
  "title": "Global Leaders Conclude Trade Summit with Landmark Pact",
  "url": "https://www.reuters.com/world/trade-summit-agreement-2026",
  "content": "Representatives from forty nations signed a comprehensive tariff reduction treaty on Monday...",
  "content_availability": "full_text",
  "canonical_url": null,
  "content_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "duplicate_of_article_id": null,
  "published_at": "2026-10-27T06:00:00Z",
  "retrieved_at": "2026-10-27T06:30:00Z",
  "created_at": "2026-10-27T06:30:00Z"
}
```
- **Error Response** (`404 Not Found`):
```json
{
  "detail": "Article with ID 999 not found"
}
```

#### 6. Create an Article Manually
- **Route**: `POST /api/articles`
- **Request Body**:
```json
{
  "source_id": 1,
  "title": "Clean Energy Grid Upgrades Receive Approval",
  "content": "Regulatory commissions today approved a multi-billion dollar framework...",
  "url": "https://www.reuters.com/sustainability/grid-upgrades-2026",
  "content_availability": "full_text",
  "published_at": "2026-10-27T07:15:00Z"
}
```
- **Response** (`201 Created`):
```json
{
  "id": 102,
  "source_id": 1,
  "source_name": "Reuters",
  "event_id": null,
  "title": "Clean Energy Grid Upgrades Receive Approval",
  "content": "Regulatory commissions today approved a multi-billion dollar framework...",
  "url": "https://www.reuters.com/sustainability/grid-upgrades-2026",
  "content_availability": "full_text",
  "canonical_url": null,
  "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "duplicate_of_article_id": null,
  "published_at": "2026-10-27T07:15:00Z",
  "retrieved_at": "2026-10-27T07:20:00Z",
  "created_at": "2026-10-27T07:20:00Z"
}
```
- **Duplicate URL Error** (`409 Conflict`):
```json
{
  "detail": "Article with this URL already exists"
}
```
- **Invalid Foreign Key** (`404 Not Found`):
```json
{
  "detail": "News source with ID 999 not found"
}
```

### RSS Ingestion Endpoints

#### 1. Trigger RSS Ingestion Run
- **Route**: `POST /api/ingestion/run` (or `POST /api/v1/ingestion/run`)
- **Request Body** *(optional)*:
```json
{
  "max_articles_per_feed": 20
}
```
*(Optionally provide a custom `"feeds": [{"source_name": "...", "base_url": "...", "feed_url": "..."}]` list to ingest specific feeds).*
- **Response** (`200 OK`):
```json
{
  "feeds_attempted": 5,
  "feeds_successful": 5,
  "articles_inserted": 24,
  "articles_skipped_duplicate": 8,
  "feed_errors": 0,
  "details": [
    {
      "source_name": "BBC News",
      "feed_url": "https://feeds.bbci.co.uk/news/world/rss.xml",
      "status": "success",
      "articles_inserted": 6,
      "articles_skipped_duplicate": 2,
      "error": null
    },
    {
      "source_name": "Reuters",
      "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
      "status": "success",
      "articles_inserted": 5,
      "articles_skipped_duplicate": 1,
      "error": null
    }
  ]
}
```

#### 2. List Configured RSS Feeds
- **Route**: `GET /api/ingestion/feeds` (or `GET /api/v1/ingestion/feeds`)
- **Response** (`200 OK`):
```json
[
  {
    "source_name": "BBC News",
    "base_url": "https://www.bbc.com",
    "feed_url": "https://feeds.bbci.co.uk/news/world/rss.xml"
  },
  {
    "source_name": "Reuters",
    "base_url": "https://www.reuters.com",
    "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best"
  }
]
```

---

## 🧪 11. Running Automated Tests

Run the full automated test suite (57 tests) using `pytest`:

```bash
pytest -v
```

Expected output:
```text
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_list_sources_empty PASSED [  1%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_create_source_success PASSED [  3%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_create_source_duplicate_conflict PASSED [  5%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_create_source_validation_errors PASSED [  7%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_get_source_by_id_success PASSED [  8%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_get_source_by_id_not_found PASSED [ 10%]
tests/test_api_endpoints.py::TestNewsSourcesAPI::test_list_sources_ordered_and_paginated PASSED [ 12%]
tests/test_api_endpoints.py::TestArticlesAPI::test_list_articles_empty PASSED [ 14%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_create_article_success PASSED [ 15%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_create_article_duplicate_url_conflict PASSED [ 17%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_create_article_missing_source PASSED [ 19%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_create_article_invalid_inputs PASSED [ 21%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_get_article_by_id_success PASSED [ 22%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_get_article_by_id_not_found PASSED [ 24%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_list_articles_omits_content PASSED [ 26%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_list_articles_filter_by_source PASSED [ 28%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_list_articles_pagination PASSED [ 29%]
tests/test_articles_endpoints.py::TestArticlesAPI::test_api_v1_and_api_prefix_parity PASSED [ 31%]
tests/test_database.py::test_create_news_source PASSED                   [ 33%]
tests/test_database.py::test_news_source_unique_name_constraint PASSED   [ 35%]
tests/test_database.py::test_create_story_and_event_relationship PASSED  [ 36%]
tests/test_database.py::test_create_article_with_source_and_event PASSED [ 38%]
tests/test_database.py::test_event_time_independent_from_article_timestamps PASSED [ 40%]
tests/test_database.py::test_seed_database_function PASSED               [ 42%]
tests/test_database.py::test_postgresql_live_connection_and_core_models SKIPPED [ 43%]
tests/test_database.py::test_all_21_tables_represented_in_schema PASSED  [ 45%]
tests/test_database.py::test_article_content_availability_and_duplicate_detection PASSED [ 47%]
tests/test_database.py::test_article_embedding_metadata_and_constraints PASSED [ 49%]
tests/test_database.py::test_article_match_pair_ordering_and_constraints PASSED [ 50%]
tests/test_database.py::test_article_analysis_and_evidence_tables PASSED [ 52%]
tests/test_database.py::test_entities_aliases_and_analysis_entities PASSED [ 54%]
tests/test_database.py::test_news_comparison_and_composite_fk_constraints PASSED [ 56%]
tests/test_database.py::test_ai_detection_result_model PASSED            [ 57%]
tests/test_database.py::test_report_model_and_comparison_relationship PASSED [ 59%]
tests/test_health.py::test_health_check_endpoint PASSED                  [ 61%]
tests/test_health.py::test_versioned_health_check_endpoint PASSED        [ 63%]
tests/test_health.py::test_root_endpoint PASSED                          [ 64%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_normalize_url_strips_tracking_params PASSED [ 66%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_normalize_url_lowercases_host_and_scheme PASSED [ 68%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_normalize_url_handles_empty_and_invalid PASSED [ 70%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_compute_content_hash PASSED [ 71%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_clean_html_text PASSED [ 73%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_clean_html_text_none_and_empty PASSED [ 75%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_parse_entry_published_at_rfc2822 PASSED [ 77%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_parse_entry_published_at_invalid_fallback PASSED [ 78%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_extract_entry_content_full_text PASSED [ 80%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_extract_entry_content_summary_only PASSED [ 82%]
tests/test_rss_ingestion.py::TestIngestionHelpers::test_extract_entry_content_headline_only PASSED [ 84%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_ingest_single_feed_success PASSED [ 85%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_duplicate_url_prevention PASSED [ 87%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_missing_and_invalid_fields_handled_safely PASSED [ 89%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_atom_feed_ingestion PASSED [ 91%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_multiple_feeds_orchestration PASSED [ 92%]
tests/test_rss_ingestion.py::TestRSSIngestionService::test_failed_feed_does_not_block_successful_feeds PASSED [ 94%]
tests/test_rss_ingestion.py::TestIngestionAPIEndpoints::test_api_ingestion_run_success PASSED [ 96%]
tests/test_rss_ingestion.py::TestIngestionAPIEndpoints::test_api_ingestion_network_failure_handling PASSED [ 98%]
tests/test_rss_ingestion.py::TestIngestionAPIEndpoints::test_api_v1_and_api_prefix_parity PASSED [100%]

=================== 56 passed, 1 skipped in 0.25s ===================
```

### Direct PostgreSQL End-to-End Verification
To test directly against the active PostgreSQL database:
```bash
python scripts/verify_postgres.py
```

---

## 💻 12. Frontend Setup (React + Vite)

The frontend is a lightweight, responsive React single-page application built with Vite.

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm 9+

### Quickstart

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the backend API URL:**
   ```bash
   cp .env.example .env
   # VITE_API_BASE_URL defaults to http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Run automated frontend tests:**
   ```bash
   npm test
   ```

6. **Build for production:**
   ```bash
   npm run build
   ```

For detailed component documentation, check [frontend/README.md](frontend/README.md).

---

## 📋 13. Git Commands for this Commit

```bash
git add .
git commit -m "feat: add article and news source API endpoints"
git push origin main
```

