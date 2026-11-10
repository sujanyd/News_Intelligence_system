# Remaining Work Roadmap (Path to 100% Completion)

## 1. Current State Summary
At the **90% Milestone**, the Multi-Source News Intelligence System backend provides:
- Fully normalized 21-table schema with foreign keys, indexes, and cascades.
- Complete news ingestion, RSS feed normalization, and error resilience.
- Exact (SimHash/MD5) and near-duplicate semantic detection.
- Embedding pipelines with Qdrant vector indexing and local fallback.
- SAME_EVENT / RELATED_TOPIC / DIFFERENT matching engine.
- Comprehensive NLP extraction: topics, entities, facts, quotes, tone, and framing signals.
- Multi-article comparative coverage matrix and political signal attribution.
- Statistical AI-generated news detection engine (burstiness, lexical diversity, repetition) with review flagging.
- Multi-format evidence-backed intelligence report generation (Markdown, HTML, JSON).
- 206 automated tests (205 passing, 1 environment skip).

---

## 2. Outstanding Items (The Final 10%)

### 2.1 Distributed Task Queue (Celery / Redis)
- **Current State**: Scheduled background ingestion runs as an async asyncio task loop.
- **Planned Work**: Transition periodic crawling and heavy batch NLP extraction to Celery workers with Redis broker for horizontal scalability.

### 2.2 Live LLM Fine-Tuning & Local Model Quantization
- **Current State**: Tone, framing, and AI likelihood use calibrated statistical heuristics and sentence transformers.
- **Planned Work**: Optional integration with localized quantized models (e.g. Llama-3-8B-Instruct via vLLM or Ollama) for zero-shot nuance verification on ambiguous political framing signals.

### 2.3 Real-Time WebSocket Streaming
- **Current State**: Frontend polls REST endpoints for ingestion and analysis status.
- **Planned Work**: WebSocket feeds (`/ws/feed`) streaming live incoming articles, clustering updates, and anomaly alerts.

### 2.4 User Management & Role-Based Access Control (RBAC)
- **Current State**: Public local demo endpoints.
- **Planned Work**: Multi-tenant authentication (OAuth2 / JWT) with `Admin`, `Analyst`, and `Reader` roles for publishing and reviewing flagged AI articles.

---

## 3. Prioritized Completion Timeline
| Item | Effort | Priority | Target Milestone |
| :--- | :---: | :---: | :---: |
| Celery + Redis Task Orchestration | 3 days | Medium | 95% |
| WebSocket Live Feed Events | 2 days | Medium | 98% |
| RBAC & User Management | 2 days | High | 100% |
| vLLM / Local Quantized Model Support | 4 days | Low | Post-100% |
