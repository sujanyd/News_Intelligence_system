# Remaining Work & Future Roadmap

This document outlines the planned future milestones for the **News Bias and Framing Analysis System** following the current operational demo milestone.

---

## 1. Overview of Roadmap

```text
[Phase 1: Ingestion & Storage] ➔ [Phase 2: Semantic Matching] ➔ [Phase 3: Story Clustering]
             (COMPLETED)                       (COMPLETED)                     (NEXT)
                                                                                  │
[Phase 6: Reporting & UI] ◄─ [Phase 5: Cross-Source Bias] ◄─ [Phase 4: Framing & Sentiment]
       (PLANNED)                      (PLANNED)                       (PLANNED)
```

---

## 2. Upcoming Development Phases

### Phase 3: Story & Event Clustering Engine
- **Goal**: Group multiple articles from different publishers into a single persistent `Story` / `StoryEvent`.
- **Database Tables Already Prepared**: `stories`, `story_events`, `clusters`, `cluster_articles`.
- **Key Tasks**:
  - Implement incremental community detection or agglomerative clustering over the Qdrant similarity graph.
  - Automatically synthesize story titles using LLM summarization.
  - Track story evolution over time (timelines of developing news stories).

---

### Phase 4: NLP Extraction (Framing, Entities & Sentiment)
- **Goal**: Extract structural linguistics from each article.
- **Database Tables Already Prepared**:
  - `entities`, `entity_mentions` (Named Entity Recognition - spaCy / transformers).
  - `topics` (LDA or BERTopic topic modeling).
  - `quotations` (Speaker attribution and quote extraction).
  - `article_sentiments`, `article_metrics` (Polarity, subjectivity, reading ease, emotional valence).
- **Key Tasks**:
  - Extract who is quoted in each article and how they are referred to.
  - Detect loaded language, emotional intensity, and subjective adjectives.

---

### Phase 5: Cross-Publisher Bias & Framing Comparison Matrix
- **Goal**: Compare how Outlet A and Outlet B report on the `SAME` event.
- **Database Tables Already Prepared**: `bias_assessments`, `framing_signals`, `ideological_biases`, `source_credibility`.
- **Key Tasks**:
  - Calculate differential emphasis: Which facts does Outlet A include that Outlet B omits?
  - Tone comparison: Is Outlet A's coverage neutral while Outlet B uses alarmist framing?
  - Headline vs. Body alignment (Clickbait / sensationalism ratio).

---

### Phase 6: Automated Evidence-Based Reporting & Visual Dashboard
- **Goal**: Render comparative visualizations in the frontend and generate exportable reports.
- **Key Tasks**:
  - Add interactive side-by-side headline & text comparison view in React.
  - Build Radar charts / Framing scorecards for news sources.
  - Implement PDF/Markdown intelligence report export for researchers.

---

## 3. Milestones & Target Timeline

| Phase | Description | Target Timeline | Status |
|---|---|---|---|
| **Phase 1** | Ingestion, Deduplication, Normalization | Completed | ✅ Operational |
| **Phase 2** | Embeddings, Qdrant Retrieval, SAME/RELATED Matching | Completed | ✅ Operational |
| **Phase 3** | Multi-Article Story Clustering & Timeline Aggregation | Sprint 3 (Next) | 📋 Ready for dev |
| **Phase 4** | Named Entity, Topic & Sentiment Extraction Pipeline | Sprint 4 | 📋 Schema ready |
| **Phase 5** | Cross-Source Framing & Bias Scoring Matrix | Sprint 5 | 📋 Schema ready |
| **Phase 6** | Comparative UI Analytics, Charts & Report Export | Sprint 6 | 📋 Planned |

