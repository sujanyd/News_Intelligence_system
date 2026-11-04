# Faculty Review Q&A Preparation

This guide prepares you for common technical and architectural questions your professor (sir) might ask during the project review.

---

## Architecture & System Design

### Q1: "Why did you choose FastAPI over traditional frameworks like Django or Flask?"
> **Answer**:
> *"FastAPI was selected for three technical reasons:
> 1. **High Concurrency & Asynchronous I/O**: News ingestion involves fetching feeds from dozens of external HTTP servers simultaneously. FastAPI's native `async`/`await` architecture enables non-blocking I/O far better than traditional WSGI frameworks like Flask.
> 2. **Type Safety & Automatic Validation**: Using Pydantic models ensures strict data contracts for article payloads, catching malformed RSS feeds early.
> 3. **Interactive Documentation**: FastAPI automatically produces OpenAPI (Swagger) specs, which simplified frontend-backend integration for our team."*

---

### Q2: "Why do you have two databases — PostgreSQL and Qdrant? Why not store everything in one?"
> **Answer**:
> *"Each database is optimized for a different access pattern:
> - **PostgreSQL (Relational DB)**: Handles structured, ACID-compliant relational data — news sources, full article text, publishing timestamps, deduplication hashes, and classified match logs. Relational databases excel at foreign-key joins and transaction integrity.
> - **Qdrant (Vector DB)**: Relational databases are inefficient at approximate nearest-neighbor (ANN) search over hundreds of high-dimensional floating-point vectors (e.g., 384 or 1536 dimensions). Qdrant uses an HNSW (Hierarchical Navigable Small World) index optimized specifically for cosine similarity searches in sub-millisecond time.
>
> In our design, PostgreSQL remains the source of truth, while Qdrant acts as the semantic indexing engine."*

---

## Semantic Analysis & Matching

### Q3: "How does the system distinguish between SAME, RELATED, and DIFFERENT articles?"
> **Answer**:
> *"We do not rely on a single similarity threshold because two completely different economic articles might have high topical similarity. Instead, we use a multi-signal decision model:
> 1. **Vector Cosine Similarity**: We compute cosine distance between headline and body embeddings.
> 2. **Temporal Proximity**: Breaking news events happen in tight time windows. If two articles are published within 24 to 48 hours of each other, the probability of them reporting the same event is much higher.
> 3. **Lexical / Token Overlap**: We check Jaccard token overlap for specific entities (like names, organizations, places).
>
> If cosine similarity is above 0.85, temporal distance is small, and key tokens match, we classify it as **`SAME`**.
> If they share a broad topic and have moderate similarity (0.70 to 0.85) but represent distinct occurrences, we classify it as **`RELATED`**.
> Below 0.70 is categorized as **`DIFFERENT`**."*

---

### Q4: "How do you handle duplicate news articles?"
> **Answer**:
> *"We perform deduplication in two stages:
> 1. **URL Canonicalization**: We strip tracking parameters (like `utm_source`, `ref`, session tokens) and normalize schemes and trailing slashes.
> 2. **Cryptographic Content Hashing**: We clean the title and text (stripping HTML, normalizing whitespace) and compute a SHA-256 hash stored in the database. When a feed is refreshed, incoming articles matching an existing hash are discarded with an O(1) database index lookup before triggering costly embedding generation."*

---

### Q5: "Which embedding model are you using, and what about API costs?"
> **Answer**:
> *"Our service architecture is modular using the Strategy pattern (`embedding_service.py`):
> - It supports cloud providers like **OpenAI (`text-embedding-3-small`)** and **Google Gemini Embeddings**.
> - It also includes a deterministic **Mock / Local Embedding Generator** that creates 384-dimensional unit vectors.
>
> This allows us to run unit tests and offline demos without internet dependence or API costs, while switching to a production model via a single environment variable change (`EMBEDDING_PROVIDER`)."*

---

## Project Status & Roadmap

### Q6: "Is the bias and framing analysis complete?"
> **Answer** (Honest, accurate answer):
> *"Sir, we have completed the foundation and data pipeline: ingestion, cleaning, deduplication, vector embedding generation, Qdrant search, and pairwise event matching (`SAME`/`RELATED`/`DIFFERENT`).
> The database schema for bias scoring, framing signals, and sentiment is already designed (in models like `bias_assessments`, `framing_signals`, and `article_sentiments`).
> The actual NLP models for tone extraction, entity framing comparisons, and cross-outlet bias metrics are our exact next phase on the project roadmap."*

---

### Q7: "How did you test your backend?"
> **Answer**:
> *"We wrote an automated test suite with **132 test cases** using `pytest`. It covers:
> - URL normalization and deduplication edge cases.
> - Feedparser scraping resilience.
> - Embedding vector dimensions and provider switching.
> - Qdrant collection upserts and similarity search.
> - Pairwise classification boundaries (`SAME`, `RELATED`, `DIFFERENT`).
> - REST API routes and HTTP status codes.
>
> 131 tests pass cleanly, with 1 integration test automatically skipped when Docker PostgreSQL is not running."*

