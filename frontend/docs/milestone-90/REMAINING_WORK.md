# Remaining Work (Frontend, after Milestone 90%)

## Frontend work (not blocked)

1. **URLs per page** (a router) for bookmarks and the browser back button.
2. A page for **articles flagged for review** (`GET /api/articles/ai-detection/flagged`).
3. A **duplicate check** view (`POST /api/articles/{id}/detect-duplicates`).
4. Compare more than 8 articles in the detailed sections (paging).
5. Open an article's details from a report's coverage table (now only from the
   "Articles being compared" list).
6. Accessibility review with a screen reader; keyboard-only walkthrough.
7. Manual test with Person A's real semantic embeddings (sentence-transformers).

## Needs Person A (backend)

| Item | Why |
| ---- | --- |
| Fix the ordering problem (one shared analysis row) | Political, tone and comparison runs can leave an article's insights empty; the frontend works around it. |
| Headline tone | Task asks for it; not computed. |
| Fact matching across articles | Needed for "common facts" and "differing claims". |
| Escape titles in the HTML report | The HTML format inserts article titles without escaping. |
| Remove or qualify "Leaning" in report text | Conflicts with "do not label a publisher from one article". |
| Rename `coverage_score` | It is a text-length score. |
| AI detection on too little text | Send `null` instead of a fixed 0.05. |
| Count routes, search, ingestion history | Faster totals, real search, ingestion status. |
| Entity quality | e.g. "Middle East" as a person, "is expected" as a politician. |

## Honest completion estimate

About **85%** of the frontend described in the 90% task. Every step of the
required workflow works with real backend data, including AI detection, saved
comparisons and saved reports with download. Not done: page URLs, the flagged
and duplicate views, headline tone and fact agreement (backend), and a manual
test with real embeddings.
