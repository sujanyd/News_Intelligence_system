# Article Content Extraction Architecture & API Reference

This document details the **Article Content Extraction Engine** implemented in the News Bias and Framing Analysis System backend.

---

## 1. Architectural Overview

The content extraction engine extracts structured evidence from news articles into dedicated relational models under `ARTICLE_ANALYSIS`:

```text
Article (id, title, content)
   │
   └── ArticleAnalysis (id, article_id, pipeline_version, status, confidence_score)
          ├── AnalysisTopic (topic_name, relevance_score, evidence_text, start_char, end_char)
          ├── AnalysisEntity (entity_id -> Entity, mention_count, salience_score, role)
          ├── AnalysisFact (fact_statement, verification_status='unverified', confidence_score)
          └── AnalysisQuote (quote_text, speaker_name, speaker_title, source_type='speaker_opinion')
```

---

## 2. Core Extraction Modules

### 2.1. Topic Extraction (`ANALYSIS_TOPIC`)
- Extracts primary headline topic noun phrases (relevance 0.95) and multi-word capitalized concepts from article text.
- Fallback keyword extraction ensures short articles retain thematic topic anchors.
- Records character spans (`start_char`, `end_char`) and contextual excerpt text (`evidence_text`).

### 2.2. Entity Extraction & Deduplication (`ENTITY`, `ANALYSIS_ENTITY`)
- Detects entities across major types: `PERSON`, `ORGANIZATION`, `LOCATION`, `CONCEPT`.
- **Deduplication & Canonical Reuse**: Before creating an entity, checks `entities` by canonical name to avoid redundant entries across runs and articles.
- Calculates `mention_count`, position-weighted `salience_score` (0.0 to 1.0), and narrative `role` (`subject`, `quoted_source`, `location`).

### 2.3. Fact Extraction (`ANALYSIS_FACT`)
- Isolates factual assertions involving measurable statistics, dates, policy actions, and event occurrences.
- **Verification Integrity**: Explicitly sets `verification_status="unverified"` to indicate extracted statements reflect source claims rather than verified truth.
- Records exact sentence boundaries and extraction confidence scores.

### 2.4. Quote Extraction (`ANALYSIS_QUOTE`)
- Extracts direct quotations enclosed in quotation marks (`"..."`, `“...”`).
- Attributes speaker names and honorifics (e.g. Chairman, Dr., President) from preceding or subsequent clauses.
- Marks `source_type="speaker_opinion"` and `is_opinion=True` to distinguish speaker opinions from publisher narration.

---

## 3. REST API Endpoints

All endpoints are dual-mounted under `/api/articles` and `/api/v1/articles`:

| HTTP Method | Route | Description |
|---|---|---|
| `GET` | `/api/articles/{id}/extraction` | Get complete extraction bundle (analysis summary, topics, entities, facts, quotes) |
| `POST` | `/api/articles/{id}/extract` | Trigger on-demand content extraction (supports `force_reanalyze=True`) |
| `GET` | `/api/articles/{id}/topics` | Get list of extracted topics with relevance scores |
| `GET` | `/api/articles/{id}/entities` | Get list of extracted entities with mention counts and salience |
| `GET` | `/api/articles/{id}/facts` | Get list of extracted factual claims |
| `GET` | `/api/articles/{id}/quotes` | Get list of extracted quotations with speaker attribution |

---

## 4. Sample JSON Response

### `GET /api/articles/1/extraction`
```json
{
  "id": 1,
  "article_id": 1,
  "pipeline_version": "content-extract-v1.0",
  "status": "completed",
  "confidence_score": 0.9,
  "topics": [
    {
      "id": 1,
      "analysis_id": 1,
      "topic_name": "Landmark Clean Energy Transition",
      "relevance_score": 0.95,
      "evidence_text": "World Leaders Finalize Landmark Clean Energy Transition Pact"
    }
  ],
  "entities": [
    {
      "id": 1,
      "analysis_id": 1,
      "entity_id": 1,
      "entity_name": "United Nations",
      "entity_type": "ORGANIZATION",
      "mention_count": 2,
      "salience_score": 0.85,
      "role": "subject"
    }
  ],
  "facts": [
    {
      "id": 1,
      "analysis_id": 1,
      "fact_statement": "Over 190 delegations reached a historic consensus in Geneva today, committing to triple renewable capacity investments over the next decade.",
      "verification_status": "unverified",
      "confidence_score": 0.95
    }
  ],
  "quotes": [
    {
      "id": 1,
      "analysis_id": 1,
      "quote_text": "This accord establishes an unprecedented multilateral commitment toward carbon neutrality.",
      "speaker_name": "Elena Rostova",
      "speaker_title": "Summit Co-Chair",
      "source_type": "speaker_opinion",
      "is_opinion": true
    }
  ]
}
```
