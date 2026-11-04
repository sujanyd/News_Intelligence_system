# Frontend–Backend Integration Map

This document outlines how the React 19 frontend connects with the FastAPI backend, detailing every view, component, endpoint contract, and sample JSON payload.

---

## 1. Network & Integration Architecture

```text
React 19 Frontend (Vite)              FastAPI Backend (Uvicorn)
http://localhost:5173                 http://localhost:8000
        │                                      │
        ├─── GET /api/sources ─────────────────► [Sources Router]
        ├─── GET /api/articles ────────────────► [Articles Router]
        ├─── GET /api/articles/:id ────────────► [Articles Router]
        ├─── GET /api/articles/:id/similar ────► [Qdrant Vector Search]
        ├─── GET /api/articles/:id/matches ────► [Match Service DB]
        └─── POST /api/ingestion/run ──────────► [RSS Ingestion Engine]
```

### Configuration Contract
- **Frontend API Base**: `http://localhost:8000` (configurable via `VITE_API_BASE_URL`)
- **API Prefix**: `/api` (configurable via `VITE_API_PREFIX`)
- **CORS Handling**: Backend `CORSMiddleware` configured with `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.

---

## 2. Page & Component Endpoint Mapping

### View 1: Sources Management (`SourcesPage.jsx`, `SourceCard.jsx`)
- **Purpose**: Displays registered news publisher feeds, reliability ratings, and feed health.
- **Backend Call**:
  - `GET /api/sources`
  - Handler: `app.api.routes.sources.get_sources`
- **Sample Response**:
  ```json
  [
    {
      "id": 1,
      "name": "Reuters",
      "slug": "reuters",
      "website_url": "https://www.reuters.com",
      "feed_url": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
      "bias_rating": "CENTER",
      "reliability_score": 0.95,
      "is_active": true
    }
  ]
  ```

---

### View 2: Articles Catalog (`ArticlesPage.jsx`, `ArticleList.jsx`, `ArticleCard.jsx`)
- **Purpose**: Lists all ingested articles with publisher metadata, publication date, and reading summary.
- **Backend Call**:
  - `GET /api/articles?limit=20`
  - Handler: `app.api.routes.articles.get_articles`
- **Sample Response**:
  ```json
  [
    {
      "id": 1,
      "source_id": 1,
      "title": "Federal Reserve Signals Slower Pace of Interest Rate Cuts",
      "url": "https://www.reuters.com/markets/us/fed-rate-decision-2025-01/",
      "summary": "Federal Reserve policymakers signaled a cautious approach to rate adjustments amid persistent core inflation metrics.",
      "published_at": "2025-01-15T14:30:00Z",
      "word_count": 420
    }
  ]
  ```

---

### View 3: Article Detail View (`ArticleDetailPage.jsx`)
- **Purpose**: Displays full cleaned text, source information, reading metrics, and semantic similarity sections.
- **Backend Call**:
  - `GET /api/articles/{id}`
  - Handler: `app.api.routes.articles.get_article`
- **Sample Response**:
  ```json
  {
    "id": 1,
    "source_id": 1,
    "title": "Federal Reserve Signals Slower Pace of Interest Rate Cuts",
    "url": "https://www.reuters.com/markets/us/fed-rate-decision-2025-01/",
    "cleaned_text": "Federal Reserve policymakers signaled a cautious approach to future interest rate adjustments...",
    "published_at": "2025-01-15T14:30:00Z",
    "source": {
      "id": 1,
      "name": "Reuters",
      "slug": "reuters",
      "bias_rating": "CENTER"
    }
  }
  ```

---

### View 4: Semantic Similarity & Cross-Source Matching (`SimilarArticlesSection.jsx`, `SimilarArticleCard.jsx`)
- **Purpose**: Demonstrates Qdrant vector retrieval combined with pairwise classification (`SAME`, `RELATED`, `DIFFERENT`).
- **Backend Calls**:
  1. `GET /api/articles/{id}/similar?limit=5&score_threshold=0.6`
     - Returns nearest vectors from Qdrant with cosine similarity.
  2. `GET /api/articles/{id}/matches`
     - Returns rule-based pairwise classifications and confidence explanations.
- **Sample Response (`/similar`)**:
  ```json
  [
    {
      "article_id": 2,
      "title": "Fed Holds Rates Steady Amid Persistent Inflation Concerns",
      "source_name": "Associated Press",
      "similarity_score": 0.912,
      "published_at": "2025-01-15T15:10:00Z"
    }
  ]
  ```
- **Sample Response (`/matches`)**:
  ```json
  [
    {
      "id": 1,
      "article_a_id": 1,
      "article_b_id": 2,
      "classification": "SAME",
      "similarity_score": 0.912,
      "signals": {
        "headline_similarity": 0.912,
        "temporal_proximity_hours": 0.67,
        "token_overlap": 0.65,
        "decision": "SAME"
      }
    }
  ]
  ```
- **UI Presentation**:
  - Each similar card renders an interactive badge:
    - 🟢 `SAME` (Green) — Verified same real-world event.
    - 🔵 `RELATED` (Blue) — Shared broad topic or domain.
    - ⚪ `DIFFERENT` (Gray) — Disparate news item.
  - Cosine similarity percentage progress bar (e.g., `91.2% Semantic Match`).
  - Hover tooltip detailing the decision signal metrics.

---

### View 5: Live Feed Ingestion Trigger (`IngestionPage.jsx` / Ingestion Controls)
- **Purpose**: Allows the operator to trigger real-time RSS ingestion from configured feeds.
- **Backend Call**:
  - `POST /api/ingestion/run`
  - Handler: `app.api.routes.ingestion.run_ingestion`
- **Request Body**:
  ```json
  {
    "source_id": null
  }
  ```
- **Sample Response**:
  ```json
  {
    "status": "success",
    "sources_processed": 5,
    "articles_ingested": 18,
    "duplicates_skipped": 4,
    "errors": []
  }
  ```

---

## 3. Resilience & Error Handling in UI

1. **Graceful Empty States**: If vector search returns zero results, `SimilarArticlesSection.jsx` displays an informative prompt: *"No similar articles found above the threshold. Try running pairwise matching."*
2. **Backend Unavailability Banner**: If FastAPI is not reachable, API client functions throw descriptive errors and render a retryable notification banner rather than crashing the interface.
3. **Optimistic Loading**: Spinners and skeleton states are displayed during vector queries and ingestion triggers.

