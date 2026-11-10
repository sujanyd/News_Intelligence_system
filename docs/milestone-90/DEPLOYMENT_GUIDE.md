# Deployment and Operations Guide — 90% Milestone

## 1. Quick Start: Local Zero-Dependency Demo Mode

The system is configured to run out-of-the-box in **Demo Mode** using an embedded SQLite database and local CPU fallbacks, requiring no external PostgreSQL, Redis, or Qdrant containers.

### Prerequisites
- Python 3.11 or 3.12
- Git

### Steps:
```bash
# 1. Clone repository
git clone https://github.com/sujanyd/news_intellegence_AP_project.git
cd news_intellegence_AP_project

# 2. Activate virtual environment
source .venv/bin/activate
pip install -r requirements.txt

# 3. Initialize SQLite database & populate demo sources
python -m app.db.init_db

# 4. Run the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation is immediately available at `http://localhost:8000/docs`.

---

## 2. Production Architecture & Environment Configuration

For staging and production deployments, copy `.env.example` to `.env` and set the following variables:

```bash
# Core Environment
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=generate-a-secure-random-32-byte-secret-here

# Database (PostgreSQL)
DATABASE_URL=postgresql://news_admin:secure_password@postgres:5432/news_intelligence

# Vector Database (Qdrant)
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=articles_v1

# Ingestion & Scheduler Settings
INGESTION_INTERVAL_MINUTES=30
MAX_ARTICLES_PER_FEED=25
USER_AGENT=NewsIntelligenceBot/1.0 (+https://github.com/sujanyd/news_intellegence_AP_project)

# Embeddings & Inference
EMBEDDING_MODEL=all-MiniLM-L6-v2
AI_DETECTION_MODEL_VERSION=heuristic-burstiness-v1
AI_DETECTION_REVIEW_THRESHOLD=0.70
```

---

## 3. Database Migrations (Alembic)

When running against PostgreSQL:

```bash
# Run latest schema migrations
alembic upgrade head

# Verify migration status
alembic current
```

---

## 4. Ingestion & Scheduled Workers

To run a manual one-time ingestion pass across all registered RSS feeds:
```bash
python -m app.scripts.run_ingestion
```

To run background ingestion as a daemon:
```bash
python -m app.workers.scheduler
```

---

## 5. Health Checks & Monitoring

The backend exposes health and status endpoints:
- `GET /health`: Basic liveness check returning `{"status": "ok"}`.
- `GET /api/v1/system/status`: Detailed subsystem readiness (Database connectivity, Qdrant cluster status, queue latency).

