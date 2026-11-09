# Test Execution Report (Milestone 70%)

**Date**: 9 November 2026  
**Test Framework**: Pytest 9.1.1, Python 3.12.13  
**Execution Environment**: macOS Darwin  
**Total Tests Collected**: 195  
**Passed**: 194  
**Failed**: 0  
**Skipped**: 1  

---

## 1. Test Suite Summary

```
============================= test session starts ==============================
rootdir: /Users/sujanyd/news_intellegence_AP_project
plugins: anyio-4.15.1
collected 195 items

tests/test_api_endpoints.py ..................                           [  9%]
tests/test_article_embeddings.py ...............                         [ 17%]
tests/test_article_matching.py ..............                            [ 25%]
tests/test_comparison_and_reports.py .........                          [ 29%]
tests/test_content_extraction.py ..............                          [ 36%]
tests/test_database.py ......s.........                                  [ 45%]
tests/test_health.py ...                                                 [ 46%]
tests/test_political_signal.py ................                          [ 54%]
tests/test_rss_ingestion.py ................................             [ 71%]
tests/test_story_event_grouping.py .............                         [ 77%]
tests/test_text_preprocessing.py ...................                     [ 87%]
tests/test_tone_and_framing.py ...........                               [ 93%]
tests/test_vector_db_and_similarity.py ...............                   [100%]

================== 194 passed, 1 skipped, 1 warning in 1.99s ===================
```

---

## 2. Test Coverage by Pipeline Module

| Test Module | Tests | Status | Scope |
|---|---|---|---|
| `test_api_endpoints.py` | 18 | Passed | News sources CRUD, article listings, pagination, URL uniqueness, dual-prefix parity. |
| `test_article_embeddings.py` | 15 | Passed | Headline and body embedding generation, deterministic vectors, error recovery. |
| `test_article_matching.py` | 14 | Passed | Entity overlap Jaccard index, `SAME`/`RELATED`/`DIFFERENT` classification, database constraints. |
| `test_comparison_and_reports.py` | 9 | Passed | Exact/near-duplicate detection, multi-source comparisons, evidence extraction, report generation. |
| `test_content_extraction.py` | 14 | Passed | Topics, entities, facts ('unverified' status), direct quotes, speaker attribution. |
| `test_database.py` | 16 | 15 Passed, 1 Skipped | Schema constraints, composite keys, cascading deletes (`test_postgresql_connection` skipped when local PG daemon is offline). |
| `test_health.py` | 3 | Passed | Health check endpoint, database connection verification, vector db status. |
| `test_political_signal.py` | 16 | Passed | Political party/politician extraction, favorable/unfavorable signals, ideological slant, partisanship. |
| `test_rss_ingestion.py` | 32 | Passed | RSS/Atom feeds, XML parsing, HTML sanitization, timestamp parsing, network timeouts. |
| `test_story_event_grouping.py` | 13 | Passed | Story creation, event grouping, timeline disagreement, article associations. |
| `test_text_preprocessing.py` | 19 | Passed | Normalization, whitespace cleaning, canonical URLs, SHA-256 content hashes. |
| `test_tone_and_framing.py` | 11 | Passed | Article tone valence, headline framing, sentence framing cues with character offsets. |
| `test_vector_db_and_similarity.py` | 15 | Passed | Qdrant client, collections, cosine vector search, self-exclusion. |

---

## 3. Skipped Test Details

- **Test**: `tests/test_database.py::test_postgresql_connection`
- **Reason**: Conditioned on live local PostgreSQL socket availability. Skipped automatically in CI/SQLite demo mode when connecting to local PostgreSQL is not configured, preventing false-negative build failures.
