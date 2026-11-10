# Frontend Test Report (Milestone 90%)

Run on 10 Nov 2026 on branch `feat/milestone-90` (from main `5d6530c`).

## Automated

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit, component and API tests | `npx vitest run` | ✅ **358 passed**, 19 files (339 before; 19 more) |
| Lint | `npx oxlint` | ✅ 0 warnings, 0 errors |
| Production build | `npm run build` | ✅ built (JS 404 kB, 112 kB gzip) |

Changed or new tests:

- `ReportsComparison.test.jsx` (rewritten, 25 tests, was 11): `toComparison` /
  `toReport`; Reports list, open (summary, download button, plain-text backend
  report, analysis, limitations), report without its comparison, generate,
  empty and error states; `ComparisonView` (articles, backend results and
  observations, no leaning, generate and open report, error); `StoryComparison`
  (save two / all, save error); `AiDetectionSection` (estimate, measures,
  "not enough text", flagged, check again, error, invalid reply); RSS feeds.
- `coverage.test.js` (+4): `POST /comparisons` only after each extraction, with
  the right body; `POST /reports/generate` body and `GET /reports` URL; AI
  detection GET and POST URLs; comparison with a missing event; **one**
  extraction request for the three analyses.
- `ArticleDetails.test.jsx`: AI Detection section instead of "Coming soon";
  "Open its event and story" calls `navigate('stories', { name: 'event', eventId: 12 })`;
  "Not in a story yet".
- `App.test.jsx`: the new metric cards.

The automated tests use fakes for the backend; they do not reach it.

## Backend tests (Person A's, for information)

`pytest` on the backend at `5d6530c` in the scratch environment:
**208 passed, 1 skipped**, and 9 failed/errors, all in
`tests/test_semantic_embeddings.py`, because sentence-transformers / PyTorch
were **not installed** in this environment (on purpose: very large). Not a
backend defect as far as this run shows.

## Manual browser test (real backend)

Setup: Person A's backend at `5d6530c` (uvicorn, port 8001), on a copy of the
demo database (84 articles, 5 sources), `EMBEDDING_PROVIDER=mock`, in-memory
Qdrant. "Group articles" first: 66 stories, 84 events. Frontend: Vite dev
server, `VITE_USE_MOCK_DATA=false`, built-in browser.

| # | Step from the task | Result |
| - | ------------------ | ------ |
| 1 | Open dashboard | ✅ 84 articles, 5 sources, 66 / 84, 10 comparable stories, 1 comparison, 1 report: all equal to `sqlite3` counts. |
| 2 | Browse news sources | ✅ (sources and RSS feeds, also checked at 70%). |
| 3 | Open an article | ✅ The Guardian "The midterms were a thumping rebuke…" (article 50) found by search and opened. |
| 4 | Similar articles and classification | ✅ 5 similar articles with SAME / RELATED / DIFFERENT labels. |
| 5 | Open its story and events | ✅ "Open its event and story" opened event 50 on the Stories page. |
| 6 | Topics, entities, facts, quotes | ✅ 3 topics. |
| 7 | Tone and framing | ✅ including the "Headline tone: not measured on its own" line. |
| 8 | Political signals | ✅ Donald Trump, "Critical wording", with evidence. |
| 9 | Cross-source comparison | ✅ Seeded comparison #1 opened. New comparison #2 saved from the Iran story (BBC News + The Guardian, chosen automatically): articles, backend results (text length 0.44 / 0.54, topics the other mentions), summary, analysis, limitations. The two articles kept one `content-extract-v1.0` row with 4 topics each (safeguard worked). |
| 10 | Evidence-based report | ✅ Report #2 generated from comparison #2 and opened from the success message; report #3 generated as HTML on the Reports page; the HTML was shown as text (not inserted); download produced a 754-byte `text/html` file with the backend's content. |
| 11 | AI detection | ✅ Article 50: 25 %, "Low estimate", 78 % confidence (text length), `statistical-burstiness-entropy-v1` 1.0.0, 3 sentences, summary-only text, limitations. |

Also checked:

- **Console:** no errors.
- **Network:** every request 200 / 201; after the fix, one extraction request
  per article when a report loads.
- **Phone width (375 px):** no sideways scrolling on the Dashboard, a report,
  a comparison, and an article opened inside a comparison.
- **Backend stopped:** Reports, Comparisons (3 boxes) and Dashboard (3 boxes)
  show "Could not reach the backend at http://127.0.0.1:8001…" with "Try again".

Fixed during the browser test:

- `fetchArticleAnalyses` sent the extraction request twice per article.
- AI "sentence length variation" hint read the wrong way round.

Not tested by hand: "Run News Collection" (needs internet access to the
feeds), "Check again" for AI detection (automated test only), a
sentence-transformers backend.
