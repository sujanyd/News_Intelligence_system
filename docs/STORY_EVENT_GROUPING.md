# Story and Event Grouping Architecture & API Reference

This document provides technical documentation for the **Story and Event Grouping Engine** implemented in the News Bias and Framing Analysis System backend.

---

## 1. Architectural Overview

News coverage evolves as unfolding narratives (Stories) containing discrete, situated occurrences (Events).

```text
[Story] (Overarching Topic / Continuing Narrative: e.g. "Global Monetary Policy & Inflation 2026")
   │
   ├── [Event 1] (Occurrence: "Fed Cuts Benchmark Rates by 25 Bps" - 2026-11-01)
   │      ├── Article 1 (Reuters)
   │      └── Article 2 (Associated Press) [Classified: SAME event]
   │
   └── [Event 2] (Occurrence: "US Jobless Claims Fall to Historic Lows" - 2026-11-03)
          └── Article 3 (BBC News) [Classified: RELATED development]
```

---

## 2. Decision Logic & Signal Integration

The grouping service (`app.services.story_grouping.py`) synthesizes multiple evidence signals:

1. **Pairwise Classification Matching (`SAME`, `RELATED`, `DIFFERENT`)**:
   - **`SAME`**: When an incoming article matches an already-grouped article with `SAME`, it is directly associated with that exact `Event` (and therefore inherits the parent `Story`).
   - **`RELATED`**: When an article matches an article with `RELATED`, it belongs to the same broad narrative (`Story`), but represents a distinct sub-event. A new `Event` is created under that existing `Story`.
   - **`DIFFERENT`**: An article confirmed `DIFFERENT` across known candidates is evaluated against broad story-level entity signals or assigned to a new Story and Event.

2. **Entity Overlap Heuristic**:
   - Articles are **not** grouped purely based on vector similarity (which can be deceptively high across generic financial or political topics).
   - Salient named entities (people, organizations, locations, acronyms) are extracted. Candidate stories must have significant entity overlap (>= 3 shared key entities or Jaccard score >= 0.30) to qualify for story reuse without a direct pairwise match.

3. **Temporal Independence**:
   - `event_time` and `event_time_precision` ('exact', 'date', 'range', 'unknown') represent the occurrence time of the real-world incident.
   - `published_at` represents the outlet's publishing timestamp.
   - `retrieved_at` represents the ingestion system's scraping timestamp.
   - These timestamps remain completely separate in data storage and schemas.

---

## 3. REST API Endpoints

All endpoints are dual-mounted at `/api` and `/api/v1`:

### 3.1. Stories

| HTTP Method | Route | Description |
|---|---|---|
| `GET` | `/api/stories` | List all stories with `event_count` and `article_count` (paginated) |
| `POST` | `/api/stories` | Create a new Story narrative manually |
| `GET` | `/api/stories/{id}` | Get detailed Story view including list of events and mapped articles |
| `GET` | `/api/stories/{id}/events` | List all specific Events belonging to this Story |
| `GET` | `/api/stories/{id}/articles` | List all Articles linked to any Event in this Story |
| `POST` | `/api/stories/group` | Group a specific article into appropriate Story & Event |
| `POST` | `/api/stories/group/batch` | Batch group all currently ungrouped articles |

### 3.2. Events

| HTTP Method | Route | Description |
|---|---|---|
| `GET` | `/api/events` | List all events (supports `?story_id=` filter) |
| `POST` | `/api/events` | Create a new Event under an existing Story |
| `GET` | `/api/events/{id}` | Get Event details with parent story title and linked articles |
| `GET` | `/api/events/{id}/articles` | List all articles that report this specific event |

---

## 4. Sample JSON Payloads

### Grouping Request: `POST /api/stories/group`
```json
{
  "article_id": 6,
  "force_regroup": false
}
```

### Grouping Response:
```json
{
  "article_id": 6,
  "story_id": 4,
  "story_title": "Autonomous AI Agents Revolutionize Enterprise Cloud Workflows",
  "story_action": "created",
  "event_id": 5,
  "event_action": "created",
  "reason": "No suitable existing story found based on article classifications or entity signals. Created new Story 'Autonomous AI Agents Revolutionize Enterprise Cloud Workflows' and initial Event 5.",
  "matched_article_id": null
}
```
