# News Bias and Framing Analysis System

A modern, scalable system built with **FastAPI**, **PostgreSQL**, and **React** to analyze news articles for political bias, sentiment framing, narrative divergence, and coverage disparity across media publishers.

---

## 📌 1. Project Overview

The **News Bias and Framing Analysis System** is designed to help readers and researchers understand how different media outlets report on the same events. By analyzing news text, headlines, and tone, the system identifies:
- **Political Bias**: Leaning and ideological slant.
- **Framing & Narrative Tactics**: Emphasis on particular perspectives (e.g., economic vs. humanitarian framing).
- **Sentiment & Tone**: Objective reporting vs. emotionally charged language.
- **Coverage Comparison**: How various sources contrast when covering the same breaking story.

This repository hosts the backend REST API, PostgreSQL database layer, data models, analysis services, and interactive frontend.

---

## 🛠️ 2. Technology Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High-performance Python web framework)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/) (Lightning-fast ASGI web server)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & [Pydantic-Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- **Database ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (Declarative models with session dependency)
- **Database Migrations**: [Alembic](https://alembic.sqlalchemy.org/) (Versioned database schema management)
- **Database Drivers**: [psycopg (v3)](https://www.psycopg.org/psycopg3/) & [psycopg2-binary](https://www.psycopg.org/) (PostgreSQL adapters)
- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vite.dev/) (Single-page web dashboard)
- **Testing**: [pytest](https://docs.pytest.org/) & [HTTPX](https://www.python-httpx.org/) (Automated backend testing)
- **Version Control**: Git & GitHub

---

## 📂 3. Project Directory Structure

```text
news_intellegence_AP_project/
├── alembic/                     # Database migration management
│   ├── env.py                   # Migration environment configured with app settings
│   ├── script.py.mako           # Migration template
│   └── versions/                # Versioned migration scripts
│       └── 0001_initial_core_tables.py
│
├── app/
│   ├── __init__.py              # Marks app as a Python package
│   ├── main.py                  # Application entry point & FastAPI instance
│   │
│   ├── api/                     # API routing layer
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py        # Central v1 router combining all sub-routers
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           └── health.py    # Health-check endpoint (GET /health)
│   │
│   ├── core/                    # Application configuration
│   │   ├── __init__.py
│   │   └── config.py            # Environment settings loaded via Pydantic
│   │
│   ├── db/                      # Database integration
│   │   ├── __init__.py
│   │   ├── base.py              # DeclarativeBase for models
│   │   ├── session.py           # Engine creation & get_db session dependency
│   │   ├── init_db.py           # Reproducible table creation script
│   │   └── seed.py              # Sample data seeding script
│   │
│   ├── models/                  # SQLAlchemy ORM database models
│   │   ├── __init__.py          # Exports all models for Alembic discovery
│   │   ├── news_source.py       # NEWS_SOURCE table model
│   │   ├── story.py             # STORY table model
│   │   ├── event.py             # EVENT table model
│   │   └── article.py           # ARTICLE table model
│   │
│   ├── schemas/                 # Pydantic schemas (request/response validation)
│   │   ├── __init__.py
│   │   └── health.py            # HealthCheckResponse schema
│   │
│   └── services/                # Business logic & analysis algorithms
│       └── __init__.py          # News scraping, bias classification, framing logic
│
├── frontend/                    # React + Vite frontend user interface
│   ├── src/                     # Source files (components, pages, api, styles, tests)
│   ├── .env.example             # Frontend environment template (VITE_API_BASE_URL)
│   ├── package.json             # Frontend dependencies and scripts
│   └── README.md                # Frontend setup and documentation
│
├── tests/                       # Automated test suite
│   ├── __init__.py
│   ├── conftest.py              # Pytest fixtures (TestClient and test DB session)
│   ├── test_health.py           # Health-check endpoint unit tests
│   └── test_database.py         # Database model & relationship tests
│
├── .env.example                 # Template for required environment variables
├── .gitignore                   # Excludes virtual envs, secrets, and cache files
├── alembic.ini                  # Alembic configuration file
├── docker-compose.yml           # PostgreSQL container setup for local development
├── requirements.txt             # Python project dependencies
└── README.md                    # Project documentation & setup instructions
```

---

## 🗄️ 4. Core Database Schema & Relationships

The database architecture starts with four core tables modeling news information flow:

```mermaid
erDiagram
    NEWS_SOURCE ||--o{ ARTICLE : publishes
    STORY ||--o{ EVENT : contains
    EVENT ||--o{ ARTICLE : reported_by

    NEWS_SOURCE {
        int id PK
        string name "Unique publisher name"
        string base_url
        datetime created_at
    }

    STORY {
        int id PK
        string title "Overarching news narrative"
        datetime created_at
    }

    EVENT {
        int id PK
        int story_id FK "References stories.id"
        datetime event_time "Nullable incident timestamp"
        string event_time_precision "'exact', 'date', 'range', 'unknown'"
        boolean event_time_disagreement "Conflict among sources"
    }

    ARTICLE {
        int id PK
        int source_id FK "References news_sources.id"
        int event_id FK "Nullable references events.id"
        string title
        text content
        string url "Unique article URL"
        datetime published_at "Publisher timestamp"
        datetime retrieved_at "Pipeline ingestion timestamp"
        datetime created_at "DB record creation timestamp"
    }
```

### Important Design Decision: Decoupled Timestamps
- `EVENT.event_time`: When the real-world incident actually occurred.
- `ARTICLE.published_at`: When a publisher published their reporting on the event.
- `ARTICLE.retrieved_at`: When our automated scraper ingested the article.
- `ARTICLE.created_at`: When the database record was inserted.

Keeping these timestamps distinct allows the system to analyze **reporting lag**, **timeline discrepancies across sources**, and maintain accurate historical tracking.

---

## 🔍 5. Purpose of Important Files Explained

| File / Folder | Purpose in Simple Terms |
| :--- | :--- |
| `app/main.py` | The starting point of the backend. It creates the FastAPI app, configures CORS middleware, mounts routers, and defines the root endpoint. |
| `app/core/config.py` | Reads settings from your `.env` file (like database URL and app name) and makes them safely accessible with default values. |
| `app/models/` | Contains the SQLAlchemy ORM models (`NewsSource`, `Story`, `Event`, `Article`) that define table columns and relationships. |
| `app/db/session.py` | Prepares the connection to PostgreSQL. Provides `get_db()` which gives each API request a database session and closes it when done. |
| `app/db/init_db.py` | Reproducible script to create all database tables in the configured database without needing raw SQL. |
| `app/db/seed.py` | Populates sample data (a news source, story, event, and article) and verifies that foreign keys and relationships function correctly. |
| `alembic/versions/` | Stores version-controlled database migrations so schema updates can be applied consistently across different machines. |
| `docker-compose.yml` | Spins up a local PostgreSQL 16 container with one command. |
| `frontend/` | React + Vite web interface with modular navigation (Dashboard, Articles, Comparisons, Reports) and configurable API client. |
| `tests/test_database.py` | Automated tests verifying table creation, uniqueness constraints, foreign keys, relationships, and seed script execution. |

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

To apply the initial schema migration to your PostgreSQL database:

```bash
alembic upgrade head
```

To roll back the last migration if needed:
```bash
alembic downgrade -1
```

### Direct Table Creation

Alternatively, you can initialize all tables using the Python helper:

```bash
python -m app.db.init_db
```

### Seed Sample Data

Populate the database with sample records (Reuters, Global Clean Energy Summit story, Event, and Article):

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
tests/test_database.py::test_create_news_source PASSED                   [ 11%]
tests/test_database.py::test_news_source_unique_name_constraint PASSED   [ 22%]
tests/test_database.py::test_create_story_and_event_relationship PASSED  [ 33%]
tests/test_database.py::test_create_article_with_source_and_event PASSED [ 44%]
tests/test_database.py::test_event_time_independent_from_article_timestamps PASSED [ 55%]
tests/test_database.py::test_seed_database_function PASSED               [ 66%]
tests/test_health.py::test_health_check_endpoint PASSED                  [ 77%]
tests/test_health.py::test_versioned_health_check_endpoint PASSED        [ 88%]
tests/test_health.py::test_root_endpoint PASSED                          [100%]

========================= 9 passed in 0.05s =========================
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
git commit -m "feat: configure PostgreSQL and initial database models"
git push origin main
```
