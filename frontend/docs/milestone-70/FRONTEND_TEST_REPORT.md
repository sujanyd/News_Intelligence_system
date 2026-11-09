# Frontend Test Report

Run on 9 Nov 2026 on branch `feat/milestone-70` (from main `4ed9fd5`).

## Automated

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit and component tests | `npx vitest run` | ✅ **339 passed**, 19 files (313 before the milestone; 26 new) |
| Lint | `npx oxlint` | ✅ 0 warnings, 0 errors |
| Production build | `npm run build` | ✅ built (JS 382 kB, 107 kB gzip) |

New tests:

- `src/tests/coverage.test.js` (15): the coverage helpers, `toFeed`, totals read
  page by page (including the 2,000 cap), `GET /events` and
  `GET /ingestion/feeds` URLs, and `fetchArticleAnalyses` when one analysis fails.
- `src/tests/ReportsComparison.test.jsx` (11): Reports list and filter,
  opening a full report, going back, both error states; story comparison
  picker, default pair from two publishers, same-publisher warning, errors;
  RSS feed list and its error state.
- Updated: `App.test.jsx` (new metric card names), `ArticleDetails.test.jsx`
  (comparison card removed from "Coming soon").

Tests run in mock mode with the backend calls replaced by fakes; they do not
reach a real backend.

## Manual browser test (real backend)

Setup: Person A's backend at `4ed9fd5` (uvicorn, port 8001) on a **copy** of
the demo database (84 articles, 5 sources), with `EMBEDDING_PROVIDER=mock` and
an in-memory Qdrant. "Group articles" was run first: 66 stories, 84 events.
Frontend: Vite dev server with `VITE_USE_MOCK_DATA=false`. Built-in browser.

| # | Check from the task | Result |
| - | ------------------- | ------ |
| 1 | Dashboard loads | ✅ Totals 84 articles, 5 sources, 66 stories / 84 events, 10 comparable stories, all equal to the database counts (checked with `sqlite3`). |
| 2 | Sources and articles appear | ✅ 5 sources, 5 RSS feeds; articles list with 5 per page. |
| 3 | Article details work | ✅ All sections render for a Guardian article and an NPR article. |
| 4 | Similar articles show classifications | ✅ 5 similar articles with labels (e.g. DIFFERENT) and a separate similarity value. With mock embeddings the similarity values are low and not meaningful. |
| 5 | Stories and events can be explored | ✅ Story 64 (4 events) → event 84 (exact time, no conflict) → article details. |
| 6 | Insights display | ✅ e.g. 4 topics for the NPR article. |
| 7 | Tone and framing evidence | ✅ Tone, score, confidence, headline framing, signals. |
| 8 | Political signals | ✅ Republican Party and United States Senate with "No clear signal". |
| 9 | Comparisons work | ✅ Story 10: BBC News vs The Guardian chosen automatically; shared "Donald Trump", gaps listed for each side, a Guardian fact, political coverage panel. |
| 10 | Reports can be opened | ✅ Story 10 report: 3 events, 3 articles, 2 publishers, coverage table (one article "Critical −0.63"), shared and missing coverage, political entities, evidence, limitations. |

Also checked:

- No browser console errors on any page.
- No sideways scrolling at 375 px on Dashboard, Sources, Comparisons and an open report.

Not tested by hand:

- Error states against a stopped backend (covered by automated tests only).
- "Run News Collection" (needs internet access to the RSS feeds).
- Comparisons page at 375 px **after** choosing a story (its two columns
  become one column below 768 px by CSS, not seen in the browser).
