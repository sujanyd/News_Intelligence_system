# Database Schema Verification (Milestone 90%)

## 1. Schema Relational Overview

The system strictly enforces the 21-table normalized third-normal-form (3NF) relational design. All foreign key cascading constraints, composite foreign keys, check constraints, and unique indexes have been verified under SQLite (standalone demo mode) and PostgreSQL (production mode).

```
                    +---------------+
                    |  news_sources |
                    +-------+-------+
                            | 1:N
                            v
+--------+ 1:N      +-------+-------+
| stories |-------->|    events     |
+--------+          +-------+-------+
                            | 1:N
                            v
                    +---------------+ self (duplicate_of_article_id)
                    |   articles    |<------------------------------+
                    +-------+-------+                               |
                            |                                       |
       +--------------------+---------------------+                 |
       |                    |                     |                 |
       v 1:N                v 1:N                 v 1:N             |
+---------------+   +---------------+     +---------------+         |
|  embeddings   |   |article_matches|     |article_analysis         |
+---------------+   +---------------+     +-------+-------+         |
                                                  |                 |
       +--------------------+---------------------+                 |
       | 1:N                | 1:N                 | 1:N             |
       v                    v                     v                 |
+---------------+   +---------------+     +---------------+         |
|analysis_topics|   |analysis_facts |     |analysis_quotes|         |
+---------------+   +---------------+     +---------------+         |
       |                    |                     |                 |
       v 1:N                v 1:N                 v 1:N             |
+---------------+   +---------------+     +---------------+         |
|framing_signals|   |analysis_entity|---->|   entities    |<--------+ (aliases)
+---------------+   +---------------+     +---------------+
                                                  ^
                                                  |
                    +---------------+             |
                    |news_comparison|             |
                    +-------+-------+             |
                            | 1:N                 |
                            v                     |
                    +---------------+             |
                    |comparis_articl|             |
                    +-------+-------+             |
                            |                     |
       +--------------------+---------------------+
       |                    |                     |
       v 1:1                v 1:N                 v 1:1
+---------------+   +---------------+     +---------------+
|comparis_covera|   |comparis_eviden|     |comparis_politi|
+---------------+   +---------------+     +---------------+
                            |
                            v 1:N
                    +---------------+     +---------------+
                    |    reports    |     | ai_detection  | (links to articles)
                    +---------------+     +---------------+
```

---

## 2. Table Catalog (21 Verified Tables)

| # | Table Name | Model Class | Primary Purpose | Foreign Key Constraints |
|---|---|---|---|---|
| 1 | `news_sources` | `NewsSource` | Publisher registry, base URL, feed URL | None |
| 2 | `stories` | `Story` | Broad news topic / ongoing narrative | None |
| 3 | `events` | `Event` | Discrete real-world incident tied to a story | `story_id -> stories.id` |
| 4 | `articles` | `Article` | Article content, URLs, availability, hash | `source_id -> news_sources.id`, `event_id -> events.id`, `duplicate_of_article_id -> articles.id` |
| 5 | `article_embeddings` | `ArticleEmbedding` | Vector metadata referencing Qdrant point | `article_id -> articles.id` |
| 6 | `article_matches` | `ArticleMatch` | Pairwise matching (`SAME`, `RELATED`, `DIFFERENT`) | `article_id_1 -> articles.id`, `article_id_2 -> articles.id` (canonical order $id_1 < id_2$) |
| 7 | `article_analyses` | `ArticleAnalysis` | Analysis run, bias/sentiment metrics | `article_id -> articles.id` |
| 8 | `analysis_topics` | `AnalysisTopic` | Extracted topics and evidence spans | `analysis_id -> article_analyses.id` |
| 9 | `entities` | `Entity` | Canonical named entities | None |
| 10 | `entity_aliases` | `EntityAlias` | Synonyms, acronyms, and aliases | `entity_id -> entities.id` |
| 11 | `analysis_entities` | `AnalysisEntity` | Entity mention count, role, sentiment | `analysis_id -> article_analyses.id`, `entity_id -> entities.id` |
| 12 | `analysis_facts` | `AnalysisFact` | Factual assertions and claims | `analysis_id -> article_analyses.id` |
| 13 | `analysis_quotes` | `AnalysisQuote` | Direct quotations and speaker attribution | `analysis_id -> article_analyses.id` |
| 14 | `analysis_framing_signals`| `AnalysisFramingSignal` | Rhetorical frame cues with char offsets | `analysis_id -> article_analyses.id` |
| 15 | `news_comparisons` | `NewsComparison` | Cross-publisher comparison sessions | `event_id -> events.id` (nullable) |
| 16 | `comparison_articles` | `ComparisonArticle` | Junction enforcing composite FK integrity | `comparison_id -> news_comparisons.id`, `article_id -> articles.id` |
| 17 | `comparison_coverages` | `ComparisonCoverage` | Coverage depth, tone, omissions | Composite FK `(comparison_id, article_id) -> comparison_articles` |
| 18 | `comparison_evidences` | `ComparisonEvidence` | Grounded framing contrasts, omissions | Composite FK `(comparison_id, article_id) -> comparison_articles` |
| 19 | `comparison_political_signals` | `ComparisonPoliticalSignal` | Ideological slant per article | Composite FK `(comparison_id, article_id) -> comparison_articles` |
| 20 | `reports` | `Report` | Synthesized intelligence reports | `comparison_id -> news_comparisons.id` |
| 21 | `ai_detection_results` | `AIDetectionResult` | Synthetic/AI likelihood metrics | `article_id -> articles.id` (`0.0 <= ai_likelihood <= 1.0`) |

---

## 3. Storage Environments & Verification

### SQLite Standalone Demo Mode
- **URL**: `sqlite:///./news_intelligence.db` or in-memory `:memory:`
- **Foreign Keys**: Enforced via SQLAlchemy connection listener (`PRAGMA foreign_keys=ON;`).
- **Sample Seed**: Verified with `python3 -m app.db.seed`, inserting full relational records across all 21 tables.

### PostgreSQL Production Mode
- **URL**: `postgresql://[user]:[password]@[host]:5432/news_intelligence`
- **Integrity**: Enforces cascading deletes, unique constraints, and check constraints (`ck_articles_content_availability`, `ck_ai_detection_results_likelihood_range`, `ck_comparison_evidences_char_range`).
- **Connection Test**: Handled gracefully with fallback skips in test environments where local PG daemon is offline.

