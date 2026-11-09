# Frontend Audit (Milestone 70%)

Audit made on 9 Nov 2026, **before** any milestone code was written.
Frontend at `4ed9fd5` (main). Backend routes read from the FastAPI app's own
OpenAPI list at the same commit.

> These milestone documents live in `frontend/docs/milestone-70/` (not the
> top-level `docs/`) so they cannot clash with Person A's backend documents.

## 1. Project structure

```text
frontend/src/
  App.jsx            page switcher (state, no URL router) + layout
  api/               client.js (fetch, timeouts, ApiError), config.js,
                     newsApi.js (every backend call), normalize.js (checks every reply)
  components/        36 reusable parts (Card, DataTable, StatusBadge, LoadingState,
                     AlertMessage, EmptyState, and the feature sections)
  pages/             Dashboard, Articles, Stories, Sources, Comparisons, Reports
  mocks/             sample data, used only when VITE_USE_MOCK_DATA=true (tests)
  utils/             small helpers (dates, labels, grouping)
  styles/            index.css (colour tokens), App.css (all components)
  tests/             17 test files (Vitest + Testing Library)
```

- **State:** React `useState` / `useEffect` in each page. No global store.
- **Navigation:** the sidebar sets `activeTab`. There are no URLs per page, so
  a page cannot be bookmarked.
- **Git:** working tree clean, nothing uncommitted.

## 2. Feature status before the milestone

| Area | Status | Notes |
| ---- | ------ | ----- |
| Dashboard | **Partial** | Recent articles, sources, ingestion button and health check are real. **3 of 4 metric cards show `--`**: total articles, stories and events, comparisons. |
| Sources | **Partial** | List and "Add a source" are real. The configured RSS feeds (`GET /api/ingestion/feeds`) are not shown. |
| Articles list, search, source filter, refresh | ✅ Complete | Search is done in the browser over the newest 100 (the backend has no search). |
| Article details | ✅ Complete | Information, content, insights, political analysis, tone and framing, processing status, similar articles, source. |
| Similar articles, SAME / RELATED / DIFFERENT | ✅ Complete | Similarity and classification confidence are shown as separate values. |
| Stories → story → event → article | ✅ Complete | Event time and precision shown. |
| Article insights | ✅ Complete | Topics, people, organizations, locations, facts, quotes and speakers. |
| Tone and framing | ✅ Mostly complete | Overall tone, headline framing, signals, evidence, confidence. **Headline tone is missing in the backend** (only headline framing exists). |
| Political signals | ✅ Complete | Entities, wording signals, evidence; matched-pair differences on Comparisons. |
| Cross-source comparison | **Partial** | Comparisons page does pairwise matching and side-by-side of a matched pair. No story-based comparison of facts, headlines, framing or coverage gaps. |
| Reports | **Missing** | Static placeholder ("Awaiting API"). |
| "Analysis — coming soon" cards | Placeholder | AI detection and comparison cards in the article details (labelled "Coming soon"). |

Nothing was found **broken**: 313 tests pass, lint is clean, the build passes.

## 3. Backend routes (OpenAPI, 39 under `/api`)

Used by the frontend before the milestone: health, sources (list, get,
create), articles (list, get, create), extraction (get, re-run), tone-framing,
political-signals, ingestion run, embeddings, similarity, matching (run,
list, get), stories (list, get), events (get), group batch.

Exist but not used:

| Route | Why not |
| ----- | ------- |
| `GET /api/ingestion/feeds` | Not shown yet; **will be used** on the Sources page. |
| `GET /api/events` | Not needed for navigation; **will be used** to count events. |
| `GET /api/stories/{id}/events`, `/articles`, `GET /api/events/{id}/articles` | Same data is in the story / event detail replies. |
| `/topics`, `/entities`, `/facts`, `/quotes` | Same data is in `/extraction`. |
| `/tone`, `/headline-framing`, `/framing-signals` | Same data is in `/tone-framing`. |
| `/political-entities`, `/political-evidence` | Same data is in `/political-signals`. |
| `GET /api/comparisons/{id}/political-signals` | Needs a comparison id; no route lists or creates comparisons. |
| `POST /api/stories`, `POST /api/events`, `POST /api/stories/group` | Manual creation; the batch grouping button is used instead. |

**Missing in the backend** (needed by the milestone task):

| Needed | Situation |
| ------ | --------- |
| Total counts | No count route; list routes return at most 100 items per call. |
| Reports | **No report route at all**, and no export or download. |
| Comparisons list | No route that lists or creates comparisons. |
| Headline tone | Only headline *framing*; tone is for the whole article. |
| Cross-article fact matching | Facts are per article; nothing says two facts agree. |

## 4. Plan from this audit

1. **Dashboard:** real totals by reading the list routes page by page (clearly
   labelled), and "stories with 2+ articles" instead of "comparisons".
2. **Sources:** show the configured RSS feeds.
3. **Comparisons:** add a story-based comparison of two articles from
   different publishers: headlines and framing, tone, shared and missing
   entities and topics, each article's facts, political coverage.
4. **Reports:** build a report for a story **in the browser** from real backend
   data (story, events, articles, insights, tone and framing, political
   signals), with evidence and limitations. It must say that the backend has
   no report route. **No download button**, because the backend has no export.
5. **Headline tone:** not built; documented as a backend gap.
6. Keep everything that already works; reuse the existing components.
