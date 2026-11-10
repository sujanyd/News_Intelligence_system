# Backend Test Report — 90% Milestone

## 1. Executive Summary

- **Total Test Cases**: 206
- **Passed**: 205
- **Skipped**: 1 (Live PostgreSQL daemon connection test, automatically skipped in SQLite demo mode)
- **Failed**: 0
- **Duration**: ~2.05 seconds
- **Test Runner**: Pytest 8.x with `pytest-asyncio`
- **Environment**: Python 3.12, macOS Darwin 24.3.0, SQLite in-memory demo engine.

---

## 2. Test Suite Breakdown

| Test Module | Coverage Domain | Tests | Status |
| :--- | :--- | :---: | :---: |
| `tests/test_ai_detection.py` | Statistical burstiness engine, persistence, API endpoints, caching, review thresholds | 11 | **PASSED** |
| `tests/test_analysis.py` | Topic, entity, fact, and quote extraction, entity deduplication | 18 | **PASSED** |
| `tests/test_articles.py` | Ingestion, normalization, article CRUD, search filters | 15 | **PASSED** |
| `tests/test_clustering.py` | Story / event grouping, DBSCAN & agglomerative clustering | 12 | **PASSED** |
| `tests/test_comparisons.py` | Cross-article comparative matrix, evidence alignment | 16 | **PASSED** |
| `tests/test_database.py` | 21-table schema verification, FK constraints, cascade deletions, SQLite demo | 22 | **21 PASSED, 1 SKIPPED** |
| `tests/test_duplicate_detection.py` | Exact SimHash/MD5 and near-duplicate cosine verification | 14 | **PASSED** |
| `tests/test_embeddings.py` | Vector dimensionality, Qdrant mock/live fallback | 12 | **PASSED** |
| `tests/test_framing.py` | Framing signal extraction, headline analysis, evidence preservation | 16 | **PASSED** |
| `tests/test_ingestion.py` | RSS feed parsing, network error resilience, feed normalization | 14 | **PASSED** |
| `tests/test_matching.py` | SAME / RELATED / DIFFERENT classifier thresholds | 16 | **PASSED** |
| `tests/test_political_signals.py` | Political entity identification, favorability framing, signal attribution | 15 | **PASSED** |
| `tests/test_reports.py` | Markdown, HTML, JSON report generation, AI likelihood inclusion | 15 | **PASSED** |
| `tests/test_sources.py` | Source registry, validation, feed status health checks | 10 | **PASSED** |

---

## 3. Key Test Verifications

### 3.1 AI-Generated News Detection Tests (`tests/test_ai_detection.py`)
1. `test_ai_detection_engine_human_text`: Verified that human text with varied sentence lengths (burstiness 0.58) yields a low AI probability (0.16).
2. `test_ai_detection_engine_synthetic_text`: Verified that synthetic uniform-pacing text yields a high AI probability (0.88).
3. `test_ai_detection_engine_short_text`: Verified fallback handling for texts under 4 sentences.
4. `test_ai_detection_service_analyze_and_persist`: Confirmed storage in `ai_detection_results` table with exact metrics JSON.
5. `test_ai_detection_flagged_for_review_threshold`: Confirmed confidence $\ge 0.70$ triggers `flagged_for_review = True`.
6. `test_ai_detection_caching`: Confirmed repeated analyze requests without `force_reanalyze` return cached records.
7. `test_ai_detection_api_get_and_post`: Full HTTP cycle test on `/api/v1/articles/{id}/ai-detection`.
8. `test_ai_detection_api_flagged_endpoint`: Retrieval of flagged articles queue.
9. `test_ai_detection_api_404_not_found`: Proper 404 response on non-existent article ID.
10. `test_ai_detection_v1_router_prefix`: Verified both `/api/v1` and legacy `/api` routes work.
11. `test_report_includes_ai_detection`: Verified reports reflect AI probability and ethical disclaimers.

### 3.2 Regression Prevention
All existing 194 tests for database relationships, duplicate detection, matching classification, tone/framing, and comparisons continue to pass with 0 regressions.
