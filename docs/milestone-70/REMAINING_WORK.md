# Remaining Work & Milestone Roadmap (Post-70% to 100%)

## 1. Current Completion Status: Approximately 72%

With the completion of duplicate detection, cross-source news comparison, evidence extraction, and report synthesis, the core functional backend pipeline is approximately **72% functionally complete**.

All 10 required pipeline stages are implemented with real business logic, integrated with the 21-table schema, and validated across 194 automated tests.

---

## 2. Completed Pipeline Capabilities (72%)

1. **News Sources & Configuration** (CRUD, feeds, active status).
2. **RSS Ingestion & Preprocessing** (HTML stripping, normalization, timestamps, canonical URLs).
3. **Exact & Near-Duplicate Detection** (Content hashes, k-shingle Jaccard overlap, `duplicate_of_article_id`).
4. **Embeddings & Vector Search** (Headline/body vectors, Qdrant collection indexing, candidate retrieval).
5. **Pairwise Article Classification** (Multi-signal logic for `SAME`, `RELATED`, `DIFFERENT`).
6. **Story and Event Grouping** (Continuing stories, events, separate `event_time` and precision).
7. **Article Content Extraction** (Topics, entities, facts, quotes, speaker attribution).
8. **Tone and Framing Analysis** (Valence scoring, headline framing, sentence framing cues with offsets).
9. **Political Leaning Signals** (Entity party/role, favorable/unfavorable cues, slant, partisanship).
10. **Cross-Source News Comparisons** (Coverage depth, topic omissions, grounded contrastive evidence).
11. **Evidence-Based Intelligence Reports** (Synthesized reports in Markdown, HTML, JSON).

---

## 3. Remaining Roadmap to 100% Completion

### Phase A: Background Automation & Scheduling (~80% Milestone)
- Standalone background scheduler (Celery / APScheduler) for periodic RSS collection and batch embedding jobs.
- WebSocket or Server-Sent Events (SSE) for live streaming ingestion progress to the dashboard.
- Retry policies with exponential backoff for rate-limited RSS feeds.

### Phase B: Advanced AI Detection Pipeline (~88% Milestone)
- Real model integration for `ai_detection_results` (e.g., local RoBERTa or DeBERTa perplexity and burstiness estimators).
- Synthetic text likelihood scoring distinguishing human journalism from synthetic AI wire copy.

### Phase C: Granular Semantic Fact-Checking & Entity Resolution (~94% Milestone)
- Cross-article entity coreference resolution (linking aliases such as "POTUS" and "Joe Biden" dynamically).
- Automated claim cross-referencing and dispute detection between articles.

### Phase D: Enterprise Hardening & Deployment (~100% Milestone)
- Docker Compose configuration for multi-container orchestration (FastAPI + PostgreSQL + Qdrant + Redis).
- Alembic database migration scripts for production schema evolution.
- Role-based access control (RBAC) and API authentication keys.
- Comprehensive end-to-end performance benchmarking under 100,000+ article loads.
