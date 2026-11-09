# API Documentation (Milestone 70%)

All endpoints are mounted with dual prefixes: `/api/...` and `/api/v1/...`.

---

## 1. System & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health check (API, Database, Vector DB, Embeddings) |

---

## 2. News Sources

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sources` | List all active news sources with pagination |
| `POST` | `/api/sources` | Register a new news source |
| `GET` | `/api/sources/{source_id}` | Retrieve news source details |

---

## 3. Articles & Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles` | List articles with pagination (`limit`, `offset`) and `source_id` filtering |
| `POST` | `/api/articles` | Manually create an article record |
| `GET` | `/api/articles/{article_id}` | Retrieve full article body and metadata |
| `POST` | `/api/articles/{article_id}/detect-duplicates` | Evaluate exact or near-duplicates and set `duplicate_of_article_id` |
| `POST` | `/api/ingestion/run` | Execute RSS collection pipeline across configured sources |
| `GET` | `/api/ingestion/feeds` | Inspect registered RSS feed configurations and status |

---

## 4. Embeddings & Semantic Similarity

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/embeddings/generate` | Batch-generate embeddings for headlines or bodies |
| `GET` | `/api/embeddings/article/{article_id}` | Retrieve embedding metadata for an article |
| `GET` | `/api/similarity/similar/{article_id}` | Retrieve similar articles using Qdrant vector search |
| `POST` | `/api/similarity/search` | Search articles by raw text query |

---

## 5. Article Matching & Pairwise Classification

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/matches/classify-pair` | Run pairwise classifier (`SAME`, `RELATED`, `DIFFERENT`) on two articles |
| `POST` | `/api/matches/match-article/{article_id}` | Find candidates via vector search and classify matches |
| `GET` | `/api/matches/articles/{article_id}` | Retrieve stored matches for an article |

---

## 6. Stories & Events

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stories` | List all tracked continuing news stories |
| `POST` | `/api/stories` | Create a story |
| `GET` | `/api/stories/{story_id}` | Retrieve story details with mapped events and articles |
| `POST` | `/api/stories/group-article` | Automatically group an article into an appropriate story & event |
| `GET` | `/api/events` | List all events |
| `POST` | `/api/events` | Create a localized event under a story |
| `GET` | `/api/events/{event_id}` | Retrieve event details and articles |

---

## 7. Content Extraction & Insights

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles/{article_id}/extraction` | Retrieve comprehensive extracted insights (topics, entities, facts, quotes) |
| `POST` | `/api/articles/{article_id}/extract` | Trigger or force re-extraction of content |
| `GET` | `/api/articles/{article_id}/topics` | List extracted topics (`ANALYSIS_TOPIC`) |
| `GET` | `/api/articles/{article_id}/entities` | List linked entities with mention count and role (`ANALYSIS_ENTITY`) |
| `GET` | `/api/articles/{article_id}/facts` | List extracted factual assertions (`ANALYSIS_FACT`) |
| `GET` | `/api/articles/{article_id}/quotes` | List direct quotes and speaker attributions (`ANALYSIS_QUOTE`) |

---

## 8. Tone & Framing Analysis

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles/{article_id}/tone-framing` | Retrieve complete tone, headline framing, and framing signals |
| `POST` | `/api/articles/{article_id}/tone-framing/analyze` | Trigger or force re-analysis of tone and framing |
| `GET` | `/api/articles/{article_id}/tone` | Overall article tone valence and confidence |
| `GET` | `/api/articles/{article_id}/headline-framing` | Dominant headline framing pattern and evidence cues |
| `GET` | `/api/articles/{article_id}/framing-signals` | List framing signals with character offsets (`ANALYSIS_FRAMING_SIGNAL`) |

---

## 9. Political Leaning Signals

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles/{article_id}/political-signals` | Retrieve political entities, presentation signals, slant, and partisanship |
| `POST` | `/api/articles/{article_id}/political-signals/analyze` | Trigger or re-evaluate political presentation signals |
| `GET` | `/api/articles/{article_id}/political-entities` | Recognized political parties, politicians, and organizations |
| `GET` | `/api/articles/{article_id}/political-evidence` | Sentences and clauses serving as evidence for political presentation |

---

## 10. Cross-Source News Comparisons

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/comparisons` | Initiate cross-publisher comparison session across articles or an event |
| `GET` | `/api/comparisons` | List comparison sessions |
| `GET` | `/api/comparisons/{comparison_id}` | Detailed comparison session with coverages, evidences, and political signals |
| `GET` | `/api/comparisons/{comparison_id}/evidence` | List grounded framing contrasts, omissions, and tone discrepancies |
| `GET` | `/api/comparisons/{comparison_id}/coverage` | Coverage depth, dominant framing, and omitted topics per article |
| `GET` | `/api/comparisons/{comparison_id}/political-signals` | Cross-outlet political leaning comparison and diversity summary |

---

## 11. Evidence-Based Reports

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reports/generate` | Synthesize an evidence-based intelligence report from a comparison session |
| `GET` | `/api/reports` | List generated intelligence reports |
| `GET` | `/api/reports/{report_id}` | Retrieve single report with full Markdown/HTML/JSON content |
