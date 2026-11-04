# News Bias and Framing Analysis System
## Executive Project Status Report (Pre-Demo Review)

**Date**: November 4, 2026  
**Audience**: Project Review Committee / College Professor  
**System Name**: News Bias and Framing Analysis System (Multi-Source News Intelligence System)  
**Primary Tech Stack**: Python 3.12, FastAPI, PostgreSQL / SQLite fallback, Qdrant Vector Search, React 19 + Vite

---

## 1. Executive Summary

The **News Bias and Framing Analysis System** is an end-to-end multi-source news intelligence platform designed to ingest news coverage across publishers, detect duplicates, generate dense semantic representations, index vectors in a vector database, and classify pairwise article relationships into **`SAME`**, **`RELATED`**, or **`DIFFERENT`**.

Ahead of the college evaluation, this audit verified:
1. **Backend Service Architecture**: Completely implemented and verified across 131 automated unit and integration tests.
2. **Database Schema**: 21 relational tables designed and migrated with strict foreign keys and canonical constraints.
3. **Frontend Integration**: Full-stack React dashboard connected to live backend APIs displaying real ingested articles, source metadata, semantic vectors, and pairwise classification badges.
4. **Demonstration Reliability**: Standalone and Dockerized run modes available ensuring zero reliance on external network stability during the in-person presentation.

---

## 2. Comprehensive Module Implementation Status

| Module | Planned Functionality | Actual Status | Evidence in Codebase | Demonstration Readiness |
| :--- | :--- | :--- | :--- | :--- |
| **FastAPI Setup** | Application starts, CORS, API router prefixes (`/api`, `/api/v1`) | **COMPLETE AND TESTED** | `app/main.py`, `app/api/v1/router.py` | 100% Live |
| **Relational Database** | PostgreSQL connection with SQLite local fallback support | **COMPLETE AND TESTED** | `app/db/session.py`, `app/db/base.py`, Alembic migrations | 100% Live |
| **Database Schema** | 21 relational tables covering Sources, Stories, Events, Articles, Matches, Analyses | **COMPLETE AND TESTED** | `app/models/*.py`, `tests/test_database.py` (21 tables verified) | 100% Live |
| **News Sources** | Source management, validation, listing and pagination | **COMPLETE AND TESTED** | `app/api/v1/endpoints/sources.py`, `tests/test_api_endpoints.py` | 100% Live |
| **RSS Ingestion** | Automated multi-feed RSS retrieval, XML cleaning, error handling & retries | **COMPLETE AND TESTED** | `app/services/rss_ingestion.py`, `app/api/v1/endpoints/ingestion.py` | 100% Live |
| **Deduplication** | Canonical URL normalization (removing tracking params), content SHA-256 hash matching | **COMPLETE AND TESTED** | `app/services/rss_ingestion.py`, `tests/test_rss_ingestion.py` | 100% Live |
| **Text Preprocessing** | HTML stripping, whitespace normalization, entity preservation, headline/body separation | **COMPLETE AND TESTED** | `app/services/text_preprocessing.py`, `tests/test_text_preprocessing.py` | 100% Live |
| **Vector Embeddings** | Configurable embedding generation (`mock`, `openai`, `gemini`) with metadata tracking | **COMPLETE AND TESTED** | `app/services/embedding.py`, `tests/test_article_embeddings.py` | 100% Live |
| **Qdrant Vector DB** | Collection creation, vector upsert, point deletion, in-memory & remote server support | **COMPLETE AND TESTED** | `app/services/vector_db.py`, `tests/test_vector_db_and_similarity.py` | 100% Live |
| **Similarity Search** | Top-$k$ nearest neighbor search using Cosine distance with strict self-exclusion | **COMPLETE AND TESTED** | `app/services/similarity.py`, `app/api/v1/endpoints/similarity.py` | 100% Live |
| **Pairwise Classification** | Multi-signal classification into **SAME**, **RELATED**, or **DIFFERENT** | **COMPLETE AND TESTED** | `app/services/matching.py`, `app/api/v1/endpoints/matching.py` | 100% Live |
| **React Frontend** | Dashboard, Articles list, News Sources, Article Details, Similar Articles, Live Mode | **COMPLETE AND TESTED** | `frontend/src/pages/*`, `frontend/src/components/*` | 100% Live |
| **Backend-Frontend Integration**| Live HTTP client connecting React to FastAPI endpoints with normalization | **COMPLETE AND TESTED** | `frontend/src/api/*`, `frontend/src/App.jsx` | 100% Live |
| **Framing & Bias Analysis** | NLP stance scoring, framing signals, tone disparity | **PLANNED / NEXT STAGE** | Evidence schema models ready (`app/models/article_analysis.py`) | Post-Demo Milestone |
| **Automated Reports** | PDF / Markdown report generation synthesizing publisher divergence | **PLANNED / NEXT STAGE** | Report schema models ready (`app/models/report.py`) | Post-Demo Milestone |

---

## 3. What Works and What is Verified

1. **Ingestion & Storage**:
   - The RSS engine reads real feeds (Reuters, BBC, AP, The Guardian, TechCrunch).
   - Articles are stripped of tracking tags, deduplicated, and stored in the database.
2. **Text Preprocessing**:
   - Cleans HTML markup, normalizes Unicode quotes, and extracts headline and body content separately without mutating original source articles.
3. **Dense Vector Embeddings & Vector Search**:
   - Text embeddings are generated and stored in Qdrant with points referenced in PostgreSQL (`vector_reference`).
   - Querying similarity returns nearest neighbors while strictly excluding the query article itself.
4. **Pairwise Classification**:
   - Evaluates headline similarity, body similarity, salient entity overlap, publication recency delta, and foreign-key event alignment.
   - Enforces canonical ordering constraint (`article_id_1 < article_id_2`) and duplicate prevention.
5. **Interactive UI**:
   - Clean dashboard running on port 5173 connected to backend on port 8000.
   - Live status indicator showing backend health.
   - Inspection panel showing preprocessed content, vector embedding status, and classified similar articles with classification badges (`SAME`, `RELATED`, `DIFFERENT`).

---

## 4. Current Limitations & Honest Disclosure

1. **Bias & Framing Analysis Models**: The analytical classification of framing tactics (e.g. economic framing vs humanitarian framing) and tone disparity is modeled in the relational schema, but the actual sentiment/bias scoring algorithms are scheduled for the next development phase.
2. **Named Entity Recognition**: Salient entities are currently extracted using capitalized sequence and acronym heuristics to remain lightweight and dependency-free. A full spaCy or transformer-based NER model is planned for subsequent iterations.
3. **Offline Reliability Mode**: When PostgreSQL and Qdrant Docker containers are not running on the demo machine, the system provides a seamless local SQLite and in-memory Qdrant fallback mode so the demonstration never crashes.

