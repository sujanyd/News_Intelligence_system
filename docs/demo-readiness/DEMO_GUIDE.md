# Demonstration Guide for Faculty Review

A step-by-step 5 to 10 minute presentation guide designed for demonstrating the **News Bias and Framing Analysis System** to your professor.

---

## 1. Demo Objectives & Talking Points

### Core Story to Tell:
1. **The Problem**: Today's news ecosystem is highly fragmented. Different outlets report on the same core events with varying focus, word choices, and framing. Detecting these differences by hand across thousands of articles is impossible.
2. **Our Solution**: An automated pipeline that:
   - Ingests feeds from diverse publishers.
   - Cleans, strips HTML, and deduplicates content at the byte level.
   - Translates text into high-dimensional semantic vector spaces.
   - Leverages a vector database (Qdrant) for millisecond nearest-neighbor retrieval.
   - Classifies cross-publisher coverage into `SAME` event, `RELATED` topic, or `DIFFERENT`.
3. **Current Milestone**: Full end-to-end operational pipeline from RSS ingestion to vector search and multi-signal pairwise event matching, demonstrated through an interactive modern frontend.

---

## 2. Pre-Demo Setup Checklist (2 Minutes Before Demo)

1. Open your terminal in the project root:
   ```bash
   cd /Users/sujanyd/news_intellegence_AP_project
   ```
2. Start the backend:
   ```bash
   .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
3. In a second terminal tab, start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
4. Open the browser to:
   - Frontend Dashboard: `http://localhost:5173`
   - FastAPI Interactive Swagger Docs: `http://localhost:8000/docs`

---

## 3. Step-by-Step 7-Minute Demo Flow

```text
[Step 1: Dashboard & Sources] ➔ [Step 2: Articles Catalog] ➔ [Step 3: Detail & Text Preprocessing]
                                                                        │
[Step 5: Architectural Wrap-up] ◄─ [Step 4: Vector Similarity & SAME/RELATED Matching]
```

### Step 1: Sources Architecture (1.5 Minutes)
- **Action**: Navigate to **Sources** (`http://localhost:5173/sources`).
- **Show**: Point out the registered news outlets (e.g., Reuters, Associated Press, BBC News, The Guardian, TechCrunch).
- **Explain**:
  > *"Sir, we have modeled a multi-source registry supporting RSS/Atom ingestion with customizable update intervals and source credibility baselines. Each source has active status flags and can be individually polled or batched."*

### Step 2: Articles & Ingestion Feed (1.5 Minutes)
- **Action**: Click on **Articles** (`http://localhost:5173/articles`).
- **Show**: Show the ingested articles from distinct publishers.
- **Explain**:
  > *"When articles arrive through RSS, they undergo our ingestion pipeline:
  > 1. We strip tracking query parameters (like UTM tags) and canonicalize URLs.
  > 2. We calculate SHA-256 hashes of the cleaned content to eliminate duplicate articles before they reach the database.
  > 3. Text is cleaned of HTML tags, scripts, and Unicode anomalies for reliable downstream NLP."*

### Step 3: Deep Dive into an Article (1.5 Minutes)
- **Action**: Click on **"Federal Reserve Signals Slower Pace of Interest Rate Cuts"** (Reuters).
- **Show**: Point out the cleaned article text, metadata (source, publication date, word count).
- **Explain**:
  > *"Here we see the normalized representation ready for semantic analysis. The system generates high-dimensional embeddings for both the headline and body text, mapping the news story into our semantic vector space."*

### Step 4: Semantic Vector Search & Event Classification (2.5 Minutes) ⭐ HIGHLIGHT
- **Action**: Scroll down to the **"Similar Coverage" / "Related Articles"** section on the Article Detail page.
- **Show**:
  1. Point out the matched article: **"Fed Holds Rates Steady Amid Persistent Inflation Concerns"** from the **Associated Press**.
  2. Point out the **`SAME`** classification badge (Green) and the similarity score (~91%).
  3. Point out the second matched article: **"US Job Market Shows Resilience with 215,000 New Jobs in December"** with a **`RELATED`** badge (Blue).
- **Explain**:
  > *"This is the core semantic intelligence layer we implemented.
  > Rather than relying on simple keyword matching, we query Qdrant using vector embeddings to find semantic neighbors.
  > Then, our matching engine analyzes multiple signals:
  > - Cosine semantic similarity.
  > - Publication time window (to verify whether stories are happening in the same news cycle).
  > - Named entity and token overlap.
  >
  > Because Reuters and AP report the exact same economic event using different headlines, our system correctly categorizes them as **SAME**.
  > Meanwhile, an article on US job statistics is categorized as **RELATED** because it shares the macroeconomic theme, but describes a different event."*

### Step 5: Backend API Documentation (1 Minute)
- **Action**: Switch to `http://localhost:8000/docs`.
- **Show**: Scroll through the Swagger API documentation (`/api/articles/{id}/similar`, `/api/articles/{id}/matches`, `/api/ingestion/run`).
- **Explain**:
  > *"All services are modular and exposed via standard RESTful endpoints. The backend test suite covers 131 automated unit and integration tests, ensuring production stability as we begin implementing the bias and framing analysis phase."*

---

## 4. Fallback & Backup Plan (If Live Network / Ports Fail)

- **Standalone Mode is active**: The demo runs completely offline with `news_bias.db` (SQLite) and in-memory Qdrant. No external database server or cloud connection is needed.
- **If the frontend port 5173 is occupied**: Run `npm run dev -- --port 5174`.
- **Swagger UI Backup**: If the frontend has any browser caching issue, open `http://localhost:8000/docs`, execute `GET /api/articles/1/matches` directly in front of the professor to show the live backend output.

