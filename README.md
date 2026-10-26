# News Bias and Framing Analysis System

A modern, scalable backend system built with **FastAPI** and **PostgreSQL** to analyze news articles for political bias, sentiment framing, narrative divergence, and coverage disparity across media publishers.

---

## 📌 1. Project Overview

The **News Bias and Framing Analysis System** is designed to help readers and researchers understand how different media outlets report on the same events. By analyzing news text, headlines, and tone, the system identifies:
- **Political Bias**: Leaning and ideological slant.
- **Framing & Narrative Tactics**: Emphasis on particular perspectives (e.g., economic vs. humanitarian framing).
- **Sentiment & Tone**: Objective reporting vs. emotionally charged language.
- **Coverage Comparison**: How various sources contrast when covering the same breaking story.

This repository hosts the backend REST API, data pipelines, database models, and analysis services.

---

## 🛠️ 2. Technology Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High-performance Python web framework)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/) (Lightning-fast ASGI web server)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & [Pydantic-Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- **Database ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (PostgreSQL-ready session and model architecture)
- **Database Driver**: [psycopg2-binary](https://www.psycopg.org/) (PostgreSQL adapter for Python)
- **Testing**: [pytest](https://docs.pytest.org/) & [HTTPX](https://www.python-httpx.org/) (Automated endpoint testing)
- **Version Control**: Git & GitHub

---

## 📂 3. Project Directory Structure

The project is structured according to FastAPI best practices to keep code modular, readable, and easy to maintain:

```text
news_intellegence_AP_project/
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
│   │           └── health.py    # Health check endpoint (GET /health)
│   │
│   ├── core/                    # Application configuration
│   │   ├── __init__.py
│   │   └── config.py            # Environment settings loaded via Pydantic
│   │
│   ├── db/                      # Database integration (PostgreSQL ready)
│   │   ├── __init__.py
│   │   ├── base.py              # SQLAlchemy DeclarativeBase
│   │   └── session.py           # Engine creation & get_db session dependency
│   │
│   ├── models/                  # SQLAlchemy ORM models (database tables)
│   │   ├── __init__.py
│   │   └── base.py
│   │
│   ├── schemas/                 # Pydantic schemas (request/response validation)
│   │   ├── __init__.py
│   │   └── health.py            # HealthCheckResponse schema
│   │
│   └── services/                # Business logic & analysis algorithms
│       └── __init__.py          # News scraping, bias classification, framing logic
├── frontend/                    # React + Vite frontend user interface
│   ├── src/                     # Source files (components, pages, api, styles, tests)
│   ├── .env.example             # Frontend environment template (VITE_API_BASE_URL)
│   ├── package.json             # Frontend dependencies and scripts
│   └── README.md                # Frontend setup and documentation
│
├── tests/                       # Automated test suite
│   ├── __init__.py
│   ├── conftest.py              # Pytest fixtures (TestClient setup)
│   └── test_health.py           # Health-check endpoint unit tests
│
├── .env.example                 # Template for required environment variables
├── .gitignore                   # Excludes virtual envs, secrets, and cache files
├── requirements.txt             # Python project dependencies
└── README.md                    # Project documentation & setup instructions
```

---

## 🔍 4. Purpose of Important Files Explained

| File / Folder | Purpose in Simple Terms |
| :--- | :--- |
| `app/main.py` | The starting point of the application. It creates the FastAPI app, configures CORS middleware, mounts routers, and defines the root endpoint. |
| `app/core/config.py` | Reads settings from your `.env` file (like database URL and app name) and makes them safely accessible with default values. |
| `app/api/v1/` | Contains API endpoints grouped by feature. If you add news article routes later, they will be placed here. |
| `app/schemas/` | Defines what input and output data looks like using Pydantic. It automatically validates incoming requests and formats API responses. |
| `app/db/session.py` | Prepares the connection to PostgreSQL. Provides `get_db()` which gives each API request a database session and closes it when done. |
| `app/models/` | Defines Python classes that map to PostgreSQL tables (like `Article`, `Publisher`, and `BiasScore`). |
| `app/services/` | Contains the core algorithms (e.g. sentiment score calculations, framing classification, and news fetching) kept separate from the API routes. |
| `frontend/` | React + Vite web interface with modular navigation (Dashboard, Articles, Comparisons, Reports) and configurable API client. |
| `tests/test_health.py` | Automated tests verifying that the server starts and the health-check endpoint responds correctly with HTTP 200. |

---

## 🚀 5. Getting Started (Local Setup)

Follow these simple steps in your terminal to set up and run the backend locally:

### Step 1: Clone the Repository

```bash
git clone https://github.com/sujanyd/News_Intelligence_system.git
cd News_Intelligence_system
```

### Step 2: Create and Activate a Virtual Environment

It is recommended to use Python 3.10, 3.11, or 3.12:

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
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

The default values in `.env` are configured for local development:
```env
PROJECT_NAME="News Bias and Framing Analysis System"
API_V1_PREFIX="/api/v1"
ENVIRONMENT="development"
DEBUG=True
HOST="0.0.0.0"
PORT=8000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/news_bias_db"
```

---

## 💻 6. Running the Server

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

## 🧪 7. Running Automated Tests

Run the test suite using `pytest`:

```bash
pytest -v
```

Expected output:
```text
tests/test_health.py::test_health_check_endpoint PASSED
tests/test_health.py::test_versioned_health_check_endpoint PASSED
tests/test_health.py::test_root_endpoint PASSED
========================= 3 passed in 0.02s =========================
```

---

## 🗄️ 8. PostgreSQL Integration (Ready for Next Steps)

The database layer in `app/db/session.py` is initialized with SQLAlchemy:
- It safely reads `DATABASE_URL` from `.env`.
- SQLAlchemy does not connect over the network until queries are issued, allowing local development and testing to run smoothly without requiring an active PostgreSQL database right now.
- In the next commit, database migrations (Alembic) and ORM models (`Article`, `BiasAnalysis`, etc.) can be plugged directly into `app/models/` and `app/db/base.py`.

---

## 💻 9. Frontend Setup (React + Vite)

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

## 📋 10. Git Commands for this Commit

To commit and push these changes:

```bash
git status
git add .
git commit -m "chore: initialize React frontend and project repository"
git push origin main
```
