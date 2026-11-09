# API Integration Status

Checked on 9 Nov 2026 against the backend at `4ed9fd5` (main). Every route
below was called by the running frontend during the browser test, except
where noted.

✅ = used by the frontend · ➖ = exists, not needed (same data elsewhere) ·
❌ = needed but missing in the backend

## Used by the frontend

| Area | Route | Used by |
| ---- | ----- | ------- |
| Health | `GET /health` | Dashboard "Check connection" |
| Sources | `GET /api/sources`, `GET /api/sources/{id}`, `POST /api/sources` | Sources, Dashboard, source names |
| Articles | `GET /api/articles?limit&offset&source_id`, `GET /api/articles/{id}` | Articles, Dashboard, details; **totals** (read page by page) |
| Ingestion | `POST /api/ingestion/run` | Dashboard "Run News Collection" |
| Ingestion feeds | `GET /api/ingestion/feeds` | Sources → RSS Feeds (**new**) |
| Embeddings | `GET /api/embeddings/article/{id}` | Article processing status |
| Similarity | `GET /api/similarity/article/{id}` | Similar articles |
| Matching | `POST /api/articles/{id}/match`, `GET /api/articles/{id}/matches`, `GET /api/matches/{id}` | Similar articles labels, Comparisons pairwise matching |
| Stories | `GET /api/stories?skip&limit`, `GET /api/stories/{id}` | Stories, Comparisons, Reports; **story totals** (**new**) |
| Events | `GET /api/events/{id}` | Stories → event |
| Events list | `GET /api/events?skip&limit` | Dashboard **event total** (**new**) |
| Grouping | `POST /api/stories/group/batch?limit=200` | Stories "Group articles" |
| Insights | `GET /api/articles/{id}/extraction`, `POST /api/articles/{id}/extract` | Article Insights, Comparisons, Reports |
| Tone and framing | `GET /api/articles/{id}/tone-framing` | Tone and Framing, Comparisons, Reports |
| Political | `GET /api/articles/{id}/political-signals` | Political Analysis, Comparisons, Reports |

## Exist but not used (➖)

`GET /api/stories/{id}/events`, `/stories/{id}/articles`,
`/events/{id}/articles` (in the detail replies), `/topics`, `/entities`,
`/facts`, `/quotes` (in `/extraction`), `/tone`, `/headline-framing`,
`/framing-signals` (in `/tone-framing`), `/political-entities`,
`/political-evidence` (in `/political-signals`), `POST …/tone-framing/analyze`,
`POST …/political-signals/analyze`, `POST /api/stories`, `POST /api/events`,
`POST /api/stories/group`, `POST /api/embeddings/generate`, `POST /api/articles`.

`GET /api/comparisons/{id}/political-signals` cannot be used: there is no
route to list or create comparisons.

## Missing in the backend (❌), and what the frontend does

| Needed by the task | What the frontend does now | Ask Person A |
| ------------------ | -------------------------- | ------------ |
| Totals (articles, stories, events) | Reads each list page by page (at most 2,000 items, then shows "2000+") | A count route, or `total` in list replies |
| Reports | Builds a report **in the browser** from the story and its articles' analyses; says so on the page; no download | A report route and an export (PDF/JSON) |
| Comparisons list | Compares two articles of a story picked by the user | A route to list/create comparisons |
| Headline tone | Not shown (only headline *framing* exists) | Tone of the headline alone |
| Fact agreement across articles | Facts shown side by side, with a note that nothing checks agreement | Fact matching between articles |
| Last ingestion run | Not shown | Store and send the last run's time and result |
| Search | Done in the browser over the newest 100 articles | A `q` parameter on `GET /api/articles` |

## Error handling

All calls go through `client.js`: network failures, timeouts, HTTP errors
(with the backend's `detail`), and replies in the wrong shape all become an
`ApiError` with a readable message, shown in an error box with "Try again".
