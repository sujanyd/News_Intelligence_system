# Frontend Integration Audit — 12 November 2026

Project: Multi-Source News Intelligence System.
Person A (sujanyd): backend. Person B (sahitya0xsingh): frontend.

This is Person B's integration audit. Person A's report is
`2026-11-12-final-implementation-report.md`, and the deferred tasks are in Person A's
`docs/DEFERRED_INFRASTRUCTURE_TASKS.md`. Both are kept as Person A wrote them.
The two audits do not agree on three checklist rows. Section 11 lists the
differences so they can be settled together.

Testing has **not** started. The dedicated testing phase begins on
14 November 2026. Nothing in this report says a test, an end-to-end workflow,
PostgreSQL, persistent Qdrant or RSS scheduling works.

## 1. Person A — backend status

Person A's commit for today is `cd87631 feat(backend): complete news intelligence backend features`. It:

- adds `GET /api/dashboard/summary` (`app/api/v1/endpoints/dashboard.py`, `app/schemas/dashboard.py`).
  It returns every total, plus the embedding provider, its dimension and the Qdrant mode;
- stops copying `published_at` into `event_time` in `app/services/story_grouping.py`.
  New events now get `event_time = null` with precision `unknown`;
- adds `docs/daily-progress/2026-11-12-backend-completion.md`.

The backend has services for RSS ingestion, preprocessing, duplicate detection,
embeddings (Sentence Transformers, 384 dimensions), Qdrant storage, similarity,
matching, story and event grouping, content extraction, tone and framing,
political signals, AI detection, comparison and reports (`app/services/`).

Three points found during the audit (Person A's files, not changed by Person B):

1. **Entity aliases.** `app/models/entity_alias.py` exists, but no service
   writes aliases and no schema or route returns them. Only the table exists.
2. **Event-time extraction.** No code reads an event time from the article text.
   After `cd87631` every new event has `event_time = null` and precision
   `unknown`, and `event_time_disagreement` is never set to true.
   Events created before `cd87631` still carry the publication time as their event time.
3. **Documentation.** `app/schemas/dashboard.py` and the backend report say articles are
   flagged at an AI likelihood of 0.70 or more. The code (`app/services/ai_detection.py`)
   and the frontend both use **0.75**. Only the text needs fixing.

## 2. Person B — frontend status

Person B's commits for today are:

- `780bf25 feat(frontend): add newspaper-style design and print animations`
- `b1bbe84 refactor(frontend): remove extra and outdated content from all pages`
- `95e3888 feat(frontend): complete news intelligence dashboard`
  (details in `2026-11-12-frontend-completion.md`)

All eleven screens below exist and call the real backend. Mock mode shows a
"needs the real backend" note instead of made-up results.

## 3. Integration status

| Check | Result |
| --- | --- |
| Branches | Person B's 3 local commits were rebased onto `origin/main` (`cd87631`, then `2cf4ca8`). Nothing of Person A's was changed or overwritten: Person A's report and deferred-tasks file are kept as written, and this audit uses its own file name. |
| Conflicting files | None: the two sides changed different files. |
| Environment variables | Compatible. The backend serves the same routes under `/api` and `/api/v1`; the frontend uses `VITE_API_BASE_URL` + `VITE_API_PREFIX=/api`. CORS allows all origins in development. No secret is in a `VITE_` variable. |
| API contract | The frontend already accepts `event_time = null` with precision `unknown` (shown as "Not known"). The AI flag threshold matches (0.75). |
| New backend route | `GET /dashboard/summary` was unused. It is now integrated (below). |
| Unused backend route | `POST /articles/{id}/detect-duplicates` was never called (not by ingestion, not by the UI). It is now integrated (below). |

Integration changes made today (frontend only):

1. **Dashboard totals from `GET /dashboard/summary`.** Articles, stories,
   events, comparisons, reports and flagged articles are now exact numbers from
   one request, not lists read page by page (which stopped at 2000).
   - If the route is missing (an older backend) or fails, the dashboard falls back to
     page-by-page counting.
   - The summary has no "stories with 2 or more articles" number, so the stories are
     still read for that one card.
   - A "Semantic engine" line shows the backend's own provider, embedding dimension
     and Qdrant mode.
2. **Duplicate check in the article details.** A new "Duplicate Check" section
   shows whether the article is stored as a copy of an earlier one
   (`duplicate_of_article_id`).
   - A "Check for duplicates" button calls `POST /articles/{id}/detect-duplicates` and
     shows the result: exact, near-duplicate or none, the text overlap, the backend's
     reason and a button to open the earlier article.
   - The check stores a link in the backend, so it only runs when the user presses
     the button.

Files: `frontend/src/api/newsApi.js`, `frontend/src/api/normalize.js`,
`frontend/src/pages/Dashboard.jsx`, `frontend/src/components/ArticleDetails.jsx`,
`frontend/src/components/DuplicateCheckSection.jsx` (new), and this audit.

Checks run for these changes (these are not the testing phase):

- `npm run lint` and `npm run build` finished without errors.
- The dashboard and one article's duplicate check were opened once in a browser against
  a local copy of the backend at `cd87631`.
  - That copy used SQLite, in-memory Qdrant and the **mock** embedding provider,
    to start fast.
  - That is why its "Semantic engine" line said `mock`.
  - It does not show that the real Sentence Transformers model ran.

## 4. Feature checklist

Status: **I** = implemented, **P** = partially implemented, **M** = missing.
Every row is also **testing pending**: no row has been tested in the testing phase.

| # | Area | Capability | Status | Evidence / note |
| --- | --- | --- | --- | --- |
| 1 | Collection | RSS ingestion | I | `rss_ingestion.py`, `POST /ingestion/run`, Dashboard "Collect news" |
| 2 | Collection | Article normalization | I | canonical URL and publication-time normalization in `rss_ingestion.py` |
| 3 | Collection | Article preprocessing | I | `text_preprocessing.py`, used by embedding, matching and duplicates |
| 4 | Collection | Exact duplicate detection | I | canonical URL + content hash at ingestion; "Duplicates" count in the UI |
| 5 | Collection | Near-duplicate detection | I | shingle/Jaccard in `duplicate_detection.py`; now in the UI ("Duplicate Check"). It runs on request, not automatically at ingestion. |
| 6 | Semantic | Real Sentence Transformers provider | I | `SentenceTransformersProvider` (`all-MiniLM-L6-v2`), default in `.env.example`. A real model run was not seen today. |
| 7 | Semantic | 384-dimensional embeddings | I | `EMBEDDING_DIMENSIONS=384`; dimension check in `vector_db.py`; shown on the Dashboard |
| 8 | Semantic | Embedding storage | I | `article_embedding` model + Qdrant collection (in memory today, see deferred task 2) |
| 9 | Semantic | Vector retrieval | I | `GET /similarity/article/{id}` |
| 10 | Semantic | Similar article discovery | I | "Similar Articles" in article details |
| 11 | Semantic | SAME / RELATED / DIFFERENT | I | `matching.py`, `/articles/{id}/match(es)`; badges, confidence, dashboard split |
| 12 | Stories | Story grouping | I | `story_grouping.py`, `POST /stories/group/batch`, Stories page |
| 13 | Stories | Event grouping | I | events under stories, event details |
| 14 | Stories | Event timeline | P | Event list and publication timeline are shown, but event times are not extracted (row 15), so new events cannot be placed in real-world time order |
| 15 | Stories | Event-time extraction and precision | P | Precision and disagreement fields are stored and shown, but nothing extracts an event time; new events are always `unknown` |
| 16 | NLP | Topic extraction | I | `content_extraction.py`, Insights section |
| 17 | NLP | Entity extraction | I | same, Insights section |
| 18 | NLP | Entity aliases | M | model only; nothing fills it, no API, no UI |
| 19 | NLP | Fact extraction | I | Insights section (`is_verified=false` shown as not verified) |
| 20 | NLP | Quote extraction | I | Insights section with speaker |
| 21 | NLP | Tone analysis | I | `tone_framing.py`, Tone and Framing section |
| 22 | NLP | Headline framing analysis | I | headline framing + explanation |
| 23 | NLP | Political presentation signals | I | `political_signal.py`, Political Analysis section |
| 24 | AI detection | Backend AI detection | I | `ai_detection.py` (style measures, clamped 0.02–0.95) |
| 25 | AI detection | AI detection API | I | `/articles/{id}/ai-detection`, `/analyze`, `/flagged` |
| 26 | AI detection | Frontend display | I | AI Detection section, Dashboard flagged list and total |
| 27 | AI detection | Editorial review warning | I | "Flagged for editorial review" at 0.75 or more |
| 28 | AI detection | Uncertainty disclaimer | I | "An estimate, not proof"; detector limitations shown |
| 29 | Cross-source | News comparison | I | `comparison.py`, Comparisons page |
| 30 | Cross-source | Coverage differences | I | coverage rows in saved comparisons |
| 31 | Cross-source | Evidence records | I | `comparison_evidence`, shown with each finding |
| 32 | Cross-source | Political presentation comparisons | I | `comparison_political_signal`, `PoliticalCoverageComparison` |
| 33 | Cross-source | Source references | I | article links and publishers in comparisons and reports |
| 34 | Reports | Report generation | I | `POST /reports/generate` (Markdown / HTML / JSON) |
| 35 | Reports | Report listing | I | Reports page list |
| 36 | Reports | Report detail | I | report view with findings |
| 37 | Reports | Evidence and article navigation | I | evidence per finding; source articles open in place |
| 38 | Frontend | Dashboard | I | exact totals, collection, newest, match activity, flagged |
| 39 | Frontend | Sources | I | counts, newest article, view articles, add source, feeds |
| 40 | Frontend | Articles | I | search, filters, sort, paging, story and match columns |
| 41 | Frontend | Article details | I | all analysis sections + duplicate check |
| 42 | Frontend | Similar articles | I | similarity and match confidence kept apart |
| 43 | Frontend | Stories | I | story overview, publishers, timeline |
| 44 | Frontend | Events | I | event details, precision, disagreement badges |
| 45 | Frontend | Insights | I | topics, entities, facts, quotes, tone, political signals |
| 46 | Frontend | AI detection | I | see rows 26–28 |
| 47 | Frontend | Comparisons | I | builder with article choice, saved comparisons |
| 48 | Frontend | Reports | I | list, detail, evidence, download |

Totals: **45 implemented, 2 partially implemented, 1 missing** (48 capabilities).

## 5. Partially implemented features

- **Event timeline (row 14)** and **event-time extraction (row 15)**: the
  backend needs to read an event time from the article text (or keep `null`
  when none is stated), fill `event_time_precision`, and set
  `event_time_disagreement` when sources disagree. Owner: Person A. The frontend
  already shows the time, its precision and the disagreement badge whenever the
  backend sends them.

## 6. Missing features

- **Entity aliases (row 18)**: the backend needs to fill `entity_aliases` (for example
  "RBI" → "Reserve Bank of India") and return them with the entities. Owner: Person A.
  When it does, Person B can show the aliases next to each entity in the Insights section.

Frontend limits that are not checklist gaps (still true, listed in
`2026-11-12-frontend-completion.md`):
- There is no source status.
- Headline tone is not measured separately.
- The match split covers only the 10 newest articles.
- Search and sort work on the newest 100 articles.
- A match review cannot be saved.

## 7. The three deferred tasks

These are not implemented or claimed. Person A's plan for 13 November is in
`docs/DEFERRED_INFRASTRUCTURE_TASKS.md`.

1. PostgreSQL deployment and live connection verification.
2. Persistent Qdrant deployment and restart verification.
3. Automated RSS scheduling.

## 8. Completion figures

Method: implemented = 1, partially implemented = 0.5, missing = 0.

- **A. Application feature implementation, without the three deferred tasks:**
  (45 + 2 × 0.5) / 48 = 46 / 48 = **95.8 %**.
  Counting only fully implemented rows, it is 45 / 48 = 93.8 %.
- **B. Overall project, with the three deferred tasks (each counted as 0 today):**
  46 / 51 = **90.2 %**.

Neither figure is 100 %. Rows 14, 15 and 18 must be finished before A can reach 100 %.
Neither figure says anything about testing: all 48 rows are still testing pending.

## 9. Testing plan for 14 November

1. Backend: run the full `pytest` suite; record the real pass/fail output.
2. Frontend: run the full `npm test` suite.
   - Update the existing tests for the screens changed on 12 November (Dashboard, Articles,
     Sources, Stories, article details), which now show more columns and sections.
   - Add tests for the dashboard summary path, its fallback, and `DuplicateCheckSection`.
3. End-to-end on the 13 November set-up (PostgreSQL + persistent Qdrant + real
   Sentence Transformers), following one pass through the app:
   1. collect news;
   2. embed, then find similar articles and classify the pairs;
   3. group the articles into stories;
   4. run the insights and AI detection;
   5. compare, then generate a report and download it.
4. Restart test: stop and start the backend and Qdrant, then check that the data and the
   similarity results are still there.
5. Scheduler test: let the automatic collection run for several cycles.
6. Write each result as it was seen, failures included.

## 10. Git commits

Today's commits (12 November), oldest first:

| Hash | Author | Message |
| --- | --- | --- |
| `e5066ae` | sahitya0xsingh | test: verify semantic news intelligence workflow |
| `cd87631` | sujanyd | feat(backend): complete news intelligence backend features |
| `2cf4ca8` | sujanyd | chore: integrate completed news intelligence features (Person A's report and deferred tasks) |
| `e806900` | sahitya0xsingh | feat(frontend): add newspaper-style design and print animations |
| `4760626` | sahitya0xsingh | refactor(frontend): remove extra and outdated content from all pages |
| `e2d6463` | sahitya0xsingh | feat(frontend): complete news intelligence dashboard |
| (this commit) | sahitya0xsingh | chore: integrate completed news intelligence features (this audit, dashboard summary, duplicate check) |

All earlier commits (28 October to 11 November) are in `git log main`.

## 11. Differences from Person A's final report

These need to be settled between Person A and Person B. Neither report was changed to hide them.

| Row | Person A's report | This audit | What was checked |
| --- | --- | --- | --- |
| 14 Event timeline | Implemented | Partial | Event list and order exist; event times are not extracted (row 15) |
| 15 Event-time extraction and precision | Implemented | Partial | `story_grouping.py` (since `cd87631`) sets `event_time = None` and precision `unknown` for every new event; no code reads a time from the text |
| 18 Entity aliases | Implemented | Missing | `app/models/entity_alias.py` exists; no service writes aliases and no schema or route returns them |
| 2–3 Normalization / preprocessing | cites `app/services/article_cleaning.py` | Implemented | That file is not in the repository; the work is in `rss_ingestion.py` and `text_preprocessing.py` |
| 5 Near-duplicate detection | "64-bit SimHash Hamming distance" | Implemented | `duplicate_detection.py` uses word shingles and Jaccard similarity, not SimHash |
| 27 Editorial review warning | threshold ≥ 0.70 | threshold ≥ 0.75 | `app/services/ai_detection.py` and the frontend both use 0.75 |

The completion figures differ for the same reason. Person A's report counts
48 / 48 (A = 100 %, B = 94.1 %). This audit counts rows 14, 15 and 18 as not
finished (A = 95.8 %, B = 90.2 %).
