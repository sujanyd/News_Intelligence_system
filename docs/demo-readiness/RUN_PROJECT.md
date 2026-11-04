# How to Run the Project (Step-by-Step Guide)

This guide provides the exact commands required to run the backend, frontend, and automated tests for the **News Bias and Framing Analysis System**.

---

## 1. Quick Start: Standalone Demo Mode (Recommended)

Standalone mode uses **SQLite** and **in-memory Qdrant**. It requires **zero external services** (no Docker, no external Postgres, no internet API keys) and is 100% reliable for college demos and presentations.

### Step 1: Open Project Directory
```bash
cd /Users/sujanyd/news_intellegence_AP_project
```

### Step 2: Ensure Environment Configuration
Verify your `.env` contains:
```ini
ENVIRONMENT=development
DATABASE_URL=sqlite:///./news_bias.db
QDRANT_URL=:memory:
EMBEDDING_PROVIDER=mock
```

### Step 3: Run Database Seed Script (If starting fresh)
To populate demo sources, articles, embeddings, and cross-source matches:
```bash
.venv/bin/python scripts/seed_demo_data.py
```
*(This seeds 5 news sources, 6 cross-publisher articles, and pairwise classifications).*

### Step 4: Start the FastAPI Backend
```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API is available at: `http://localhost:8000`
- Swagger UI Documentation: `http://localhost:8000/docs`
- Healthcheck endpoint: `http://localhost:8000/health`

### Step 5: Start the React Frontend
In a new terminal window:
```bash
cd /Users/sujanyd/news_intellegence_AP_project/frontend
npm run dev
```
- Frontend UI is available at: `http://localhost:5173`

---

## 2. Full Production Mode (Docker PostgreSQL + Qdrant Server)

Use this setup when running full multi-container deployments.

### Step 1: Start Docker Containers
```bash
docker compose up -d
```
This starts:
- PostgreSQL on `localhost:5433` (or `5432`)
- Qdrant on `localhost:6333`

### Step 2: Update `.env` for Docker Services
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/news_intel
QDRANT_URL=http://localhost:6333
```

### Step 3: Apply Database Migrations / Initialize Tables
```bash
.venv/bin/python -c "from app.core.database import init_db; init_db()"
```

### Step 4: Run Ingestion & Services
```bash
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 3. Running Automated Tests

Run the full pytest suite:

```bash
cd /Users/sujanyd/news_intellegence_AP_project
.venv/bin/pytest tests/ -v
```

### To run specific test suites:
- Ingestion & deduplication:
  ```bash
  .venv/bin/pytest tests/test_deduplication.py tests/test_rss_service.py -v
  ```
- Vector embeddings & Qdrant search:
  ```bash
  .venv/bin/pytest tests/test_embeddings.py tests/test_vector_service.py -v
  ```
- Semantic matching & classification:
  ```bash
  .venv/bin/pytest tests/test_matching_service.py -v
  ```

---

## 4. Frontend Production Build & Verification

To verify that the frontend compiles cleanly for production:

```bash
cd /Users/sujanyd/news_intellegence_AP_project/frontend
npm run build
```
*(Build artifacts are emitted to `frontend/dist` with zero errors).*

