# Frontend Architecture

React 19 + Vite 8. Tests with Vitest and Testing Library. Lint with oxlint.

## How a page gets its data

```text
Page or section component
  └─ calls one function in src/api/newsApi.js   (e.g. fetchStory, fetchToneFraming)
        └─ client.js: fetch with a timeout; turns HTTP and network errors into ApiError
        └─ normalize.js: checks the reply (toStory, toToneFraming, ...);
                         a reply in the wrong shape becomes an ApiError too
  └─ shows one of: LoadingState / AlertMessage (with "Try again") / EmptyState / the data
```

Rules every component follows:

- **No `fetch` in components.** All backend calls are functions in `newsApi.js`.
- **Every reply is checked** in `normalize.js`. Missing optional fields become
  `null` or `[]`; missing required fields are an error, never a made-up value.
- **Four states:** loading, error (with the backend's message and "Try
  again"), empty, and data. Errors are never hidden.
- **Stale replies are ignored:** each `useEffect` keeps an `isCurrentRequest`
  flag, so an old reply cannot overwrite a newer one.
- **Mock mode** (`VITE_USE_MOCK_DATA=true`) is only for tests and for articles
  and sources. Features that have no sample data (stories, insights, tone,
  political, reports, feeds) show "needs the real backend" instead of fake
  data. Each has an `*_AVAILABLE` flag in `newsApi.js`.

## Pages

| Page | Main components | Backend data |
| ---- | --------------- | ------------ |
| Dashboard | MetricCard, IngestionPanel, DataTable, ArticleDetails | totals (articles, stories, events, comparable stories), recent articles, sources, health, ingestion run |
| Articles | DataTable, Pagination, ArticleDetails | article list, source filter, search in the browser |
| Article details (opened from several pages) | ArticleInsightsSection, PoliticalAnalysisSection, ToneFramingSection, ProcessingStatusPanel, SimilarArticlesSection | article, extraction, political signals, tone and framing, embeddings, similarity, matches |
| Stories | StoryList, StoryDetails, EventDetails, EventTimeInfo | stories, story, event, grouping |
| Sources | DataTable, AddSourceForm, RssFeedList | sources, RSS feeds |
| Comparisons | StoryComparison, PoliticalCoverageComparison, ArticleMatchingSection, SideBySideComparison | stories, story, the three analyses of two articles, matches |
| Reports | StoryReport | stories, story, the three analyses of each article |

## Shared helpers added in this milestone

| File | What it does |
| ---- | ------------ |
| `newsApi.js` `readAllPages` | Reads a list route page by page (100 per page, at most 20 pages). Used for totals, because the backend has no count route. |
| `newsApi.js` `countArticles`, `countEvents`, `fetchAllStories` | Totals and the full story list. |
| `newsApi.js` `fetchArticleAnalyses` | Insights, tone and framing, and political analysis of one article. One failing analysis does not stop the others. |
| `newsApi.js` `fetchIngestionFeeds` | The RSS feeds of the news collection. |
| `utils/coverage.js` | Lines up analyses of several articles: shared and missing names, frames per article, publishers, date range. Counts only; never adds results. |

## Backend ordering safeguard

If the political or tone analysis of an article runs before its content
extraction, the backend keeps the article's topics, facts and quotes empty for
good (reported to Person A in `frontend/API_CONTRACT.md`). `newsApi.js` always
waits for the extraction first (`extractionFirst`) and shares one extraction
request between sections that load at the same time.

## Navigation

`App.jsx` keeps the active page in state (no URL router). Inside pages,
drill-down views (story → event → article, report list → report) are also
state. Pages cannot be bookmarked; see REMAINING_WORK.md.
