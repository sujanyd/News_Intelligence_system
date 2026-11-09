# Milestone 70% Backend Audit Report

**Date**: 9 November 2026  
**Auditor**: Antigravity Assistant (Backend Systems Architect)  
**Project**: Multi-Source News Intelligence System / News Bias and Framing Analysis System  
**Repository Branch**: `main`  
**Current Baseline**: 185 passing tests, 1 skipped test  

---

## 1. Executive Summary

This comprehensive audit evaluates the current state of the backend against the planned 21-table normalized database architecture, service pipeline, REST APIs, and automated test coverage.

### Status Highlights:
- **Core Pipeline Implementation**: High functional completeness across collection, preprocessing, embeddings, vector search, SAME/RELATED/DIFFERENT classification, story/event grouping, topic/entity/fact/quote extraction, tone/framing analysis, and political signal analysis.
- **Database Schema**: All **21 planned tables** are fully declared in SQLAlchemy models, verified via foreign key relationships, tested under SQLite (demo mode) and compatible with PostgreSQL.
- **Missing / Partial Areas**:
  1. **Near-Duplicate Detection Workflow**: Currently, exact duplicates (URL, canonical URL, and exact SHA-256 content hash) are skipped during ingestion. However, near-duplicate detection linking via the `duplicate_of_article_id` self-referential relationship on the `articles` table is not yet exposed via a dedicated detection service or API endpoint.
  2. **Cross-Source News Comparison (`NEWS_COMPARISON`, `COMPARISON_ARTICLE`, `COMPARISON_EVIDENCE`, `COMPARISON_COVERAGE`)**: Models exist and are seeded/tested in isolation, and political signals use `COMPARISON_POLITICAL_SIGNAL`. However, the core comparative analytical service and REST endpoints (`/api/comparisons/...`) to compare multi-outlet factual coverage, framing divergence, and coverage gaps are not yet implemented.
  3. **Evidence-Based Reports (`REPORT`)**: The `reports` table exists in ORM models and is seeded, but there is no dedicated reporting service or API endpoint (`/api/reports/...`) to synthesize comparative findings into structured intelligence reports.

---

## 2. Feature-by-Feature Status Matrix

| Pipeline Component | Status | Tested? | Details |
|---|---|---|---|
| **1. News Collection & Ingestion** | **COMPLETE** | Yes (`test_rss_ingestion.py`) | Configured sources, RSS parser, XML/Atom feed handling, HTML stripping, network error recovery. |
| **2. Text Preprocessing & Normalization** | **COMPLETE** | Yes (`test_text_preprocessing.py`) | Clean content, canonical URL, dates, content hashing, whitespace normalization. |
| **3. Exact Duplicate Detection** | **COMPLETE** | Yes (`test_rss_ingestion.py`, `test_api_endpoints.py`) | Deduplication by URL, canonical URL, and exact SHA-256 hash across feeds. |
| **4. Near-Duplicate Detection** | **PARTIAL** | Model tested (`test_database.py`) | `duplicate_of_article_id` model relation exists; automated near-duplicate resolution service & API needed. |
| **5. Embeddings & Vector DB** | **COMPLETE** | Yes (`test_article_embeddings.py`, `test_vector_db_and_similarity.py`) | Qdrant integration, mock/SentenceTransformers providers, collection management, fallback resilience. |
| **6. Semantic Similarity Search** | **COMPLETE** | Yes (`test_vector_db_and_similarity.py`) | Retrieval of candidate matches with cosine similarity scores, threshold filtering. |
| **7. Pairwise Article Classification** | **COMPLETE** | Yes (`test_article_matching.py`) | Multi-signal classifier (`SAME`, `RELATED`, `DIFFERENT`) combining vectors, entities, dates, and event links. |
| **8. Story & Event Grouping** | **COMPLETE** | Yes (`test_story_event_grouping.py`) | Continuing story tracking, event clustering, separate `event_time`, precision, and disagreement tracking. |
| **9. Content Extraction** | **COMPLETE** | Yes (`test_content_extraction.py`) | Salient topics (`ANALYSIS_TOPIC`), entities (`ENTITY`, `ANALYSIS_ENTITY`), facts (`ANALYSIS_FACT`), quotes (`ANALYSIS_QUOTE`). |
| **10. Tone & Framing Analysis** | **COMPLETE** | Yes (`test_tone_and_framing.py`) | Valence scoring, headline framing, sentence-level framing signals with offsets (`ANALYSIS_FRAMING_SIGNAL`). |
| **11. Political Leaning Signals** | **COMPLETE** | Yes (`test_political_signal.py`) | Party/politician extraction, favorable/unfavorable cues, ideological slant, `COMPARISON_POLITICAL_SIGNAL`. |
| **12. Cross-Source News Comparison** | **NOT IMPLEMENTED** | Models only | Tables `news_comparisons`, `comparison_articles`, `comparison_evidences`, `comparison_coverages` need service & APIs. |
| **13. Evidence-Based Reports** | **NOT IMPLEMENTED** | Model only | Table `reports` exists; needs analytical report generation service and `/api/reports` endpoints. |
| **14. AI Detection Metadata** | **MODEL & SEED ONLY** | Schema tested | `ai_detection_results` table exists; optional advanced feature deferred to post-70%. |

---

## 3. Database Schema Verification (21 Tables)

All 21 required tables are verified in `app/models/` and registered with SQLAlchemy `Base.metadata`:

1. `news_sources`: Source registry, base URLs, feed links, active status.
2. `stories`: Broad ongoing narratives / continuing coverage.
3. `events`: Specific real-world occurrences tied to stories, with `event_time` and precision.
4. `articles`: Core article records, URL, canonical URL, content hash, content availability, and self-referential `duplicate_of_article_id`.
5. `article_embeddings`: Vectors in Qdrant with dimensions, model name, and embedding type.
6. `article_matches`: Pairwise article classification (`SAME`, `RELATED`, `DIFFERENT`), canonical ordering `(id_1 < id_2)`, similarity, and confidence.
7. `article_analyses`: Pipeline execution run, bias metrics, sentiment score, confidence, summary.
8. `analysis_topics`: Thematic topics, relevance scores, and evidence spans.
9. `entities`: Canonical named entities (Person, Organization, Location, Concept, Government).
10. `entity_aliases`: Alternative names/acronyms resolving to canonical entities.
11. `analysis_entities`: Link between article analysis and entity with mention counts, local sentiment, and roles.
12. `analysis_facts`: Factual claims with verification status and extraction confidence.
13. `analysis_quotes`: Verbatim quotes, speaker attribution, and opinion vs. factual classification.
14. `analysis_framing_signals`: Rhetorical framing cues with character offsets (`start_char`, `end_char`) and intensity.
15. `news_comparisons`: Comparative multi-outlet analytical sessions.
16. `comparison_articles`: Junction enforcing composite foreign key `(comparison_id, article_id)`.
17. `comparison_coverages`: Relative coverage depth, tone differences, dominant frames, and omitted topics.
18. `comparison_evidences`: Granular contrastive evidence items (framing contrasts, quote choices, omissions) with character ranges.
19. `comparison_political_signals`: Per-article political leaning and slant scores within a comparison.
20. `reports`: Synthesized narrative intelligence reports linked to comparisons.
21. `ai_detection_results`: Synthetic/AI content probability estimations and perplexity/burstiness metadata.

---

## 4. Identified Gaps & Required Actions for Milestone 70%

To achieve **approximately 70% functional completion** across the entire project vision:

1. **Near-Duplicate Detection**:
   - Provide a service function and API endpoint (`POST /api/articles/detect-duplicates` or `POST /api/articles/{id}/detect-duplicates`) that evaluates candidate articles using high lexical/vector similarity ($\ge 0.92$), detects syndicated or near-identical republications, and sets `duplicate_of_article_id`.
2. **Cross-Source News Comparison Module**:
   - Create `app/services/comparison.py` to compare articles covering the same event/story.
   - Synthesize factual coverage, identify agreements and discrepancies, identify omitted topics, and record entries in `comparison_coverages` and `comparison_evidences`.
   - Expose REST API routes in `app/api/v1/endpoints/comparisons.py` (`POST /api/comparisons`, `GET /api/comparisons`, `GET /api/comparisons/{id}`, `GET /api/comparisons/{id}/evidence`, `GET /api/comparisons/{id}/coverage`).
3. **Evidence-Based Reports Module**:
   - Create `app/services/report.py` to compile comparison results, story overviews, participating publishers, tone/framing contrasts, and political signals into structured reports (`REPORT` table).
   - Expose REST API routes in `app/api/v1/endpoints/reports.py` (`POST /api/reports/generate`, `GET /api/reports`, `GET /api/reports/{id}`).
4. **Integration & Parity**:
   - Register comparison and report routers in `app/api/v1/router.py`.
   - Ensure dual mounting parity (`/api/...` and `/api/v1/...`).
5. **Testing**:
   - Add unit and integration tests for duplicate detection, news comparison, and report generation.
   - Run the complete backend test suite and verify 0 regressions.
6. **Documentation**:
   - Produce all required documents in `docs/milestone-70/`.
