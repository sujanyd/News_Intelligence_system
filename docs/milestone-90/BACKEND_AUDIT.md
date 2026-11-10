# Milestone 90% Backend Audit Report

**Date**: 10 November 2026  
**Auditor**: Antigravity Assistant (Backend Systems Architect)  
**Project**: Multi-Source News Intelligence System / News Bias and Framing Analysis System  
**Repository Branch**: `main`  
**Current Baseline**: 194 passing tests, 1 skipped test  

---

## 1. Executive Summary

This audit assesses the backend codebase for transition to **Milestone 90%**, examining:
- The 21 planned database tables and their constraints.
- The 10 core intelligence pipeline components.
- The AI text detection module (`ai_detection_results`).
- Cross-module API routing and error resilience.
- Standalone SQLite demo mode vs. PostgreSQL and Qdrant persistence.

### Status Highlights:
- **Core Pipeline Implementation (Modules 1–7 & 9–10)**: Fully implemented and tested across 194 automated test cases. Ingestion, preprocessing, duplicate detection, embeddings, vector search, SAME/RELATED/DIFFERENT classification, story/event grouping, content extraction, tone/framing analysis, political leaning analysis, cross-source comparison, and evidence-based reports are functional.
- **Identified Gap (Module 8: AI-Generated News Detection)**:
  - Table `ai_detection_results` is defined in `app/models/ai_detection_result.py` with foreign key and check constraints.
  - However, no service engine exists to analyze text for AI characteristics (burstiness, perplexity, vocabulary repetition), and no dedicated API endpoints (`/api/articles/{id}/ai-detection`) are currently registered.
- **Reporting Integration**:
  - The report generation service (`app/services/report.py`) needs to optionally include AI-detection estimates when available for compared articles.

---

## 2. Feature-by-Feature Classification Matrix

| Feature / Pipeline Stage | Status | Tests | Notes |
|---|---|---|---|
| **1. News Collection & RSS Ingestion** | **COMPLETE AND TESTED** | `test_rss_ingestion.py` (32 tests) | Feed parsing, network failure recovery, sanitization, title fallback. |
| **2. Text Preprocessing & Hashing** | **COMPLETE AND TESTED** | `test_text_preprocessing.py` (19 tests) | Canonical URLs, SHA-256 hashes, Unicode cleaning. |
| **3. Exact & Near-Duplicate Detection** | **COMPLETE AND TESTED** | `test_comparison_and_reports.py` | Exact hash match, k-shingle Jaccard overlap, `duplicate_of_article_id` linking. |
| **4. Embeddings & Vector DB** | **COMPLETE AND TESTED** | `test_article_embeddings.py`, `test_vector_db_and_similarity.py` (30 tests) | Qdrant client, dense vectors, mock & transformer support. |
| **5. SAME / RELATED / DIFFERENT Matching** | **COMPLETE AND TESTED** | `test_article_matching.py` (14 tests) | Multi-signal classifier combining vectors, entities, dates, and event relations. |
| **6. Story and Event Grouping** | **COMPLETE AND TESTED** | `test_story_event_grouping.py` (13 tests) | Continuous stories, discrete events, separate `event_time` and precision. |
| **7. Article Content Extraction** | **COMPLETE AND TESTED** | `test_content_extraction.py` (14 tests) | Topics, entities, facts ('unverified'), quotes with speaker attribution. |
| **8. Tone & Framing Analysis** | **COMPLETE AND TESTED** | `test_tone_and_framing.py` (11 tests) | Valence score, headline framing, sentence framing signals with char offsets. |
| **9. Political Leaning Signal Analysis** | **COMPLETE AND TESTED** | `test_political_signal.py` (16 tests) | Party/politician extraction, favorable/unfavorable cues, slant, partisanship. |
| **10. AI-Generated News Detection** | **PARTIALLY IMPLEMENTED** | Model only | `ai_detection_results` table exists; needs service engine, API routes, and tests. |
| **11. Cross-Source News Comparison** | **COMPLETE AND TESTED** | `test_comparison_and_reports.py` | Coverage depth, omitted topics, grounded contrastive evidence. |
| **12. Evidence-Based Reports** | **COMPLETE AND TESTED** | `test_comparison_and_reports.py` | Markdown, HTML, JSON reports synthesized from comparisons. |
| **13. API Route Parity** | **COMPLETE AND TESTED** | `test_api_endpoints.py` | All routers dual-mounted on `/api/` and `/api/v1/`. |

---

## 3. Database Schema Verification (21 Tables)

All 21 tables are verified in `app/models/` and registered with SQLAlchemy `Base.metadata`:
1. `news_sources`
2. `stories`
3. `events`
4. `articles`
5. `article_embeddings`
6. `article_matches`
7. `article_analyses`
8. `analysis_topics`
9. `entities`
10. `entity_aliases`
11. `analysis_entities`
12. `analysis_facts`
13. `analysis_quotes`
14. `analysis_framing_signals`
15. `news_comparisons`
16. `comparison_articles`
17. `comparison_coverages`
18. `comparison_evidences`
19. `comparison_political_signals`
20. `reports`
21. `ai_detection_results`

---

## 4. Required Implementation for Milestone 90%

1. **AI-Generated Text Detection Module**:
   - Create `app/schemas/ai_detection.py` for request and response serialization.
   - Create `app/services/ai_detection.py` implementing statistical language modeling heuristics (burstiness, sentence perplexity variance, repetition, vocabulary uniformity) and optional transformer detector fallbacks.
   - Create `app/api/v1/endpoints/ai_detection.py` exposing:
     - `GET /api/articles/{article_id}/ai-detection`
     - `POST /api/articles/{article_id}/ai-detection/analyze`
     - `GET /api/articles/ai-detection/flagged`
   - Mount in `app/api/v1/router.py`.
2. **Report Enhancement**:
   - Update `app/services/report.py` to incorporate available AI detection scores when synthesizing comparison reports.
3. **Automated Test Suite Expansion**:
   - Create `tests/test_ai_detection.py` covering estimation heuristics, database persistence in `ai_detection_results`, review flagging, and API endpoints.
4. **Documentation**:
   - Author full documentation suite in `docs/milestone-90/`.

