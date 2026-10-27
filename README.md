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
│   │           └── health.py            # Health-check endpoint (GET /health)
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
│   │   ├── __init__.py
│   │   └── health.py                    # HealthCheckResponse schema
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
│   └── test_database.py                 # Comprehensive database models & constraint tests
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
| `app/main.py` | The starting point of the backend. It creates the FastAPI app, configures CORS middleware, mounts routers, and defines the root endpoint. |
| `app/core/config.py` | Reads settings from your `.env` file (like database URL and app name) and makes them safely accessible with default values. |
| `app/models/` | Contains all 21 SQLAlchemy ORM models defining tables, relationships, check constraints, and composite foreign keys. |
| `app/db/session.py` | Prepares the connection to PostgreSQL/SQLite. Provides `get_db()` which gives each API request an isolated database session. |
| `app/db/init_db.py` | Reproducible script to create all 21 database tables in the configured database without needing raw SQL. |
| `app/db/seed.py` | Populates rich sample data across all 21 tables (Sources, Articles, Embeddings, Analyses, Entities, Comparisons, and Reports). |
| `alembic/versions/` | Stores version-controlled database migrations (`0001_initial_core_tables` and `0002_remaining_tables_and_constraints`). |
| `docker-compose.yml` | Spins up a local PostgreSQL 16 container with one command. |
| `frontend/` | React + Vite web interface with modular navigation (Dashboard, Articles, Comparisons, Reports) and configurable API client. |
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

Default settings in `.env`:
```env
PROJECT_NAME="News Bias and Framing Analysis System"
API_V1_PREFIX="/api/v1"
ENVIRONMENT="development"
DEBUG=True
HOST="0.0.0.0"
PORT=8000
DATABASE_URL="postgresql+psycopg://postgres:postgrespassword@localhost:5432/news_bias_db"
```

---

## 🐘 7. PostgreSQL Database Setup

You have two easy ways to run PostgreSQL for this project:

### Option A: Using Docker (Recommended)

If you have Docker installed, start a local PostgreSQL container in the background:

```bash
docker compose up -d
```
To stop the database container when finished:
```bash
docker compose down
```

### Option B: Using Native PostgreSQL (Homebrew / macOS)

If you prefer running PostgreSQL natively on macOS:
```bash
brew install postgresql@16
brew services start postgresql@16
createuser -s postgres
createdb -U postgres news_bias_db
```

### Option C: Quick Local Prototyping with SQLite

If PostgreSQL is not yet installed on your system, you can develop locally with SQLite by updating `.env`:
```env
DATABASE_URL="sqlite:///./news_bias.db"
```

---

## ⚙️ 8. Running Migrations & Seeding Sample Data

### Apply Migrations (Alembic)

To apply all migrations up to the latest revision (all 21 tables and constraints):

```bash
alembic upgrade head
```

To inspect the current applied migration version:
```bash
alembic current
```

To view the migration history:
```bash
alembic history --verbose
```

To roll back the last migration step:
```bash
alembic downgrade -1
```

To roll back all migrations to a completely clean state:
```bash
alembic downgrade base
```

### Direct Table Creation

Alternatively, you can initialize all 21 tables using the Python helper:

```bash
python -m app.db.init_db
```

### Seed Sample Data

Populate the database with sample records demonstrating all functional modules:

```bash
python -m app.db.seed
```

---

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

## 🧪 10. Running Automated Tests

Run the full test suite using `pytest`:

```bash
pytest -v
```

Expected output:
```text
tests/test_database.py::test_create_news_source PASSED                   [  5%]
tests/test_database.py::test_news_source_unique_name_constraint PASSED   [ 11%]
tests/test_database.py::test_create_story_and_event_relationship PASSED  [ 16%]
tests/test_database.py::test_create_article_with_source_and_event PASSED [ 22%]
tests/test_database.py::test_event_time_independent_from_article_timestamps PASSED [ 27%]
tests/test_database.py::test_seed_database_function PASSED               [ 33%]
tests/test_database.py::test_all_21_tables_represented_in_schema PASSED  [ 38%]
tests/test_database.py::test_article_content_availability_and_duplicate_detection PASSED [ 44%]
tests/test_database.py::test_article_embedding_metadata_and_constraints PASSED [ 50%]
tests/test_database.py::test_article_match_pair_ordering_and_constraints PASSED [ 55%]
tests/test_database.py::test_article_analysis_and_evidence_tables PASSED [ 61%]
tests/test_database.py::test_entities_aliases_and_analysis_entities PASSED [ 66%]
tests/test_database.py::test_news_comparison_and_composite_fk_constraints PASSED [ 72%]
tests/test_database.py::test_ai_detection_result_model PASSED            [ 77%]
tests/test_database.py::test_report_model_and_comparison_relationship PASSED [ 83%]
tests/test_health.py::test_health_check_endpoint PASSED                  [ 88%]
tests/test_health.py::test_versioned_health_check_endpoint PASSED        [ 94%]
tests/test_health.py::test_root_endpoint PASSED                          [100%]

======================== 18 passed in 0.10s =========================
```

---

## 💻 11. Frontend Setup (React + Vite)

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

## 📋 12. Git Commands for this Commit

```bash
git add .
git commit -m "feat: implement remaining database schema and constraints"
git push origin main
```
