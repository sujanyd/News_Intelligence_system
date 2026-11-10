# Frontend Audit (Milestone 90%)

Audit made on 10 Nov 2026, **before** any milestone-90 code was written.

- Frontend at `7a6faea` (the 70% milestone).
- Backend at `5d6530c` (main). Person A added the 70% and 90% backend
  milestones (`0701cfa`, `71ebed4`) and semantic embeddings (`77f56ae`)
  after the frontend's 70% milestone.
- Git: working tree clean, nothing uncommitted.
- These documents live in `frontend/docs/milestone-90/`. The top-level
  `docs/milestone-90/` belongs to Person A (it already has a
  `REMAINING_WORK.md`, which would clash).

## 1. New backend routes since the 70% milestone

Read from the route files and schemas (`app/api/v1/endpoints/`,
`app/schemas/`):

| Route | What it does | Frontend before this milestone |
| ----- | ------------ | ------------------------------ |
| `POST /api/comparisons` (`title`, `description`, `event_id` or `article_ids` ≥ 2) | Creates and runs a comparison, returns its detail | Not used |
| `GET /api/comparisons?limit&offset` | Lists comparisons | Not used |
| `GET /api/comparisons/{id}` | Articles, coverage per article, evidence, political signals, synthesis | Not used |
| `GET /api/comparisons/{id}/evidence`, `/coverage` | Parts of the detail | Not needed (in the detail) |
| `POST /api/reports/generate` (`comparison_id`, `title`, `report_format`: markdown / html / json) | Generates and saves a report | Not used |
| `GET /api/reports?limit&offset`, `GET /api/reports/{id}` | Lists / opens saved reports | Not used |
| `GET /api/articles/{id}/ai-detection` | AI-likelihood estimate (computed on first call) | Not used |
| `POST /api/articles/{id}/ai-detection/analyze` | Re-runs it | Not used |
| `GET /api/articles/ai-detection/flagged` | Articles flagged for review | Not used |
| `POST /api/articles/{id}/detect-duplicates` | Duplicate check | Not used |

Still **missing** in the backend: headline tone (only headline framing),
count routes, fact agreement across articles, ingestion history.

## 2. What the new routes really compute (read in the services)

This decides how the frontend may present them.

| Value | How it is computed | Consequence for the UI |
| ----- | ------------------ | ---------------------- |
| Comparison `coverage_score` | `0.4 + 0.6 × text length / 2000` (`app/services/comparison.py`) | Label it as a **text-length score**, not "coverage depth". |
| Comparison `omitted_topics` | Topics other compared articles have and this one lacks | Show as "topics others mention", not proof of omission. |
| Comparison evidence | `framing_contrast` when two headlines' primary frames differ; `tone_discrepancy` when tone scores differ by ≥ 0.35. The text is written by the backend, not quoted from articles. | Show as **backend observations**, separate from article quotes. |
| Comparison political signals | `political_leaning`, `slant_score` per article from the fixed party table | **Not shown**, as before: one article does not show a publisher's politics. |
| Report `content` | Markdown / HTML / JSON written by the backend. The Markdown says "Leaning `center`" per publisher. The HTML puts titles in **without escaping**. | Render the report's structured data with our own components; show the backend text only as plain text, and offer it as a download (it is a real backend export). Never insert the HTML into the page. |
| AI `ai_likelihood` | Heuristic from sentence-length variation and vocabulary (`statistical-burstiness-entropy-v1`). Texts under 50 characters get a fixed `0.05`. | Present as an **estimate**, never proof; say "not enough text" instead of 5 % when the text was too short. |
| AI `confidence_score` | Only from the number of words (0.65 / 0.78 / 0.88; 0.50 when too short) | Say it reflects text length, not accuracy. |

Side effect found: creating a comparison runs the political analysis of each
article. If an article has no content extraction yet, this triggers the known
**"insights stay empty" ordering problem**. The frontend must run the
extraction for each article first.

## 3. Feature status before the milestone

| Area | Status |
| ---- | ------ |
| Dashboard | ✅ Totals, sources, recent articles, ingestion button. **Missing:** comparisons and reports counts (routes now exist). |
| Sources, RSS feeds | ✅ Complete |
| Articles: list, search, filter, details, similar, SAME/RELATED/DIFFERENT, similarity vs confidence | ✅ Complete |
| Article → its story / event | ⚠️ **Missing link:** an article opened from Articles or the Dashboard cannot open its event. |
| Stories → story → events → articles, event time | ✅ Complete |
| Insights | ✅ Complete |
| Tone and framing | ✅ Complete except **headline tone** (not in the backend; no unavailable state shown). |
| Political signals | ✅ Complete |
| AI detection | ❌ **Missing:** "Coming soon" card in the article details. |
| Comparisons | ⚠️ Browser-built story comparison works, but **nothing is saved** and the backend comparison routes are unused. |
| Reports | ⚠️ Browser-built story reports work, but the backend report routes and its export are unused. |
| Navigation | ⚠️ State only, no URLs; no way to go from a comparison to its report. |

Nothing was found **broken**: 339 tests pass, lint is clean, the build works.

## 4. Plan

1. **AI Detection section** in the article details (replaces "Coming soon").
2. **Backend comparisons** on the Comparisons page: list, open (articles,
   publishers, coverage, backend observations, facts and topics side by side,
   political entities, evidence, limitations), create from the story
   comparison (two articles or all articles of the story), extraction first.
3. **Backend reports** on the Reports page: list, generate from a comparison,
   open (structured view + plain-text backend report + download of the
   backend's own content).
4. **Dashboard:** counts of comparisons and reports.
5. **Headline tone:** honest "not provided by the backend" line.
6. **Navigation:** from an article to its event; from a comparison to its
   report; open an article's details from a comparison.
7. Reuse the existing sections (`StoryReport`'s analysis parts become shared).
