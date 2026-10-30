# Frontend ↔ Backend Contract (Articles and Sources)

## Integration status (updated 29 Oct 2026)

| What | Status |
| ---- | ------ |
| Frontend reaches the backend (`GET /health`) | ✅ Works (tested against the real FastAPI app) |
| CORS for the Vite dev server | ✅ Works (`allow_origins=["*"]` in `app/main.py`) |
| `GET /api/sources`, `POST /api/sources`, `GET /api/sources/{id}` | ✅ **Implemented & tested** (also mounted at `/api/v1/sources`) |
| `GET /api/articles` (+ `source_id`, `limit`, `offset`), `GET /api/articles/{id}`, `POST /api/articles` | ✅ **Implemented & tested** (also mounted at `/api/v1/articles`) |
| `POST /api/ingestion/run`, `GET /api/ingestion/feeds` | ✅ **Implemented** by Person A; the dashboard's **Run News Collection** button uses `POST /api/ingestion/run` |

**Real integration is operational.** The backend routes are fully functional and pass 36 unit/integration tests. Both `/api/...` and `/api/v1/...` prefixes are active.

### Frontend end-to-end check (28 Oct 2026)

Run in the browser with the real FastAPI app, a PostgreSQL 18 database
(filled with `python -m app.db.seed` plus test records added through the API)
and `VITE_USE_MOCK_DATA=false`:

| Frontend feature | Result |
| ---------------- | ------ |
| Sources page loads `GET /api/sources` | ✅ Shows database records |
| Add-source form → `POST /api/sources` | ✅ Saved in the database, success message, list reloaded |
| Duplicate name | ✅ Shows "News source with this name already exists (HTTP 409)" |
| Articles page loads `GET /api/articles?limit=6&offset=0` | ✅ Real titles, `source_name`, dates and `content_availability` |
| Next page (`offset=5`) | ✅ Works |
| Source filter (`source_id`) | ✅ Works; a source with no articles shows its empty state |
| "View" → `GET /api/articles/{id}` | ✅ Shows full content |
| Dashboard → `GET /health` | ✅ Works |
| Phone layout | ✅ No sideways scrolling |

### Dashboard check (29 Oct 2026)

Same setup as above:

| Dashboard feature | Result |
| ----------------- | ------ |
| Recent Articles → `GET /api/articles?limit=5&offset=0` | ✅ Newest 5 articles with source, date and content badge |
| "View" on a recent article → `GET /api/articles/{id}` | ✅ Details panel with full content |
| News Sources → `GET /api/sources` | ✅ Name, base URL and date added; the metric card shows the real count |
| "View all articles" / "Manage sources" | ✅ Open the Articles / Sources pages |
| Backend unreachable | ✅ Error message and **Try again** on both sections |
| "Run News Collection" → `POST /api/ingestion/run` | ✅ Real run: 5 feeds attempted, 2 successful, 50 new articles, 3 feed errors; articles and sources reloaded (3 → 5 sources) |
| Running the collection again | ✅ 0 new, 50 duplicates skipped |
| While running | ✅ Button disabled, "Collecting news...", second click ignored |
| Phone layout | ✅ No sideways scrolling |

### Articles search and refresh check (30 Oct 2026)

With 51 real articles from 3 sources (from one news collection run):

| Feature | Result |
| ------- | ------ |
| Search "after" | ✅ 5 matches from the newest 100, one request (`limit=100`) |
| Search + source The Guardian | ✅ 4 matches, request with `source_id=4`, note names the source |
| Typing and paging through 51 matches | ✅ No extra requests; "Page 2 of 11" |
| Normal paging | ✅ "Showing articles 6–10", Page 2 |
| Refresh articles | ✅ Button disabled while loading, search and page kept, "Last updated" time changes |
| Refresh with backend unreachable | ✅ Error message, **Try again** recovers |
| View details from search results | ✅ Full content loads |
| Phone layout | ✅ No sideways scrolling |

### Open backend issue (for Person A)

The earlier `alembic.ini` URL problem is fixed. On a fresh database (checked
30 Oct 2026), `alembic upgrade head` now stops at the second migration:
`value too long for type character varying(32)`. Alembic stores the revision
id in a `varchar(32)` column, and `0002_remaining_tables_and_constraints` is
37 characters. A shorter revision id (32 characters or fewer) should fix it.
`python -m app.db.seed` creates the tables directly, so it works in the meantime.

## Confirmed Specifications from Person A (Backend)

1. **Path prefix**: Both `/api` and `/api/v1` are mounted. The frontend's default `VITE_API_PREFIX=/api` works seamlessly without changes.
2. **List format**: Endpoints return a clean JSON array `[...]`. Compatible with `toList(data, 'source')` and `toList(data, 'article')`.
3. **Article list fields**:
   - `source_name` is populated automatically on every article via relationship eager-loading (`joinedload`).
   - `content` is excluded from article lists (`GET /api/articles`) for bandwidth optimization; the full body text is returned on `GET /api/articles/{id}`.
4. **Errors**: Uses FastAPI standard `{"detail": "..."}`. Duplicate source names and duplicate article URLs return HTTP `409 Conflict`.
5. **Required fields**:
   - Create source: `name` (required, 1-255 chars), `base_url` (required, valid http/https URL).
   - Create article: `source_id` (required, must exist), `title` (required, 1-512 chars), `url` (required, unique http/https URL). Optional: `content`, `published_at`, `event_id`, `content_availability`, `canonical_url`.
6. **Limits**: `limit` accepts 1 to 100 (default 50). Frontend's request for `limit=6` works perfectly.
7. **CORS**: `allow_origins=["*"]` enabled for local development.

## How the frontend calls the API

All calls are in `src/api/newsApi.js` and go through `src/api/client.js`.
Pages never call `fetch` directly.

| Function            | Method | Path (with `VITE_API_PREFIX=/api`)               |
| ------------------- | ------ | ------------------------------------------------ |
| `fetchSources()`    | GET    | `/api/sources`                                   |
| `fetchSource(id)`   | GET    | `/api/sources/{source_id}`                       |
| `createSource()`    | POST   | `/api/sources`                                   |
| `fetchArticles()`   | GET    | `/api/articles?limit=6&offset=0&source_id=3`     |
| `fetchArticle(id)`  | GET    | `/api/articles/{article_id}`                     |
| `createArticle()`   | POST   | `/api/articles`                                  |
| `checkBackendHealth()` | GET | `/health` (exists today)                         |
| `runNewsCollection()` | POST | `/api/ingestion/run` with body `{}`              |

Pagination: the page shows 5 articles. It asks for `limit=6`, and if 6 come
back it knows there is a next page. `offset = (page - 1) × 5`.

### Articles page: what the backend does and what the browser does

| Feature | Where it happens |
| ------- | ---------------- |
| Source filter | **Backend** (`source_id`) |
| Paging while not searching | **Backend** (`limit`, `offset`) |
| Title search | **Browser**: `GET /api/articles` has no search parameter, so the page loads the newest **100** articles once (`limit=100`, the backend maximum, plus `source_id` if a source is picked) and filters their titles. Older articles are not searched. Typing sends no requests. |
| Paging through search results | **Browser** (the 100 articles are already loaded) |
| **Refresh articles** | **Backend**: sends the same request again and keeps the search, source and page. It does not run news collection. |

If Person A adds a search parameter (for example `q`), the search can move to
the backend; it would then need a short delay (debounce) so typing does not
send a request for every letter.

## Expected shapes

Field names follow `app/models/news_source.py` and `app/models/article.py`.
Every reply is checked by `src/api/normalize.js`; anything that does not
match is shown as an error, never as made-up data.

### Source

```json
{ "id": 1, "name": "Daily Ledger", "base_url": "https://dailyledger.example", "created_at": "2026-10-01T09:00:00Z" }
```

Required by the frontend: `id`, `name`. Optional: `base_url`, `created_at`.

POST body: `{ "name": "...", "base_url": "https://..." }`

### Article (real reply from `GET /api/articles`)

```json
{
  "id": 1,
  "source_id": 1,
  "source_name": "Reuters",
  "event_id": 1,
  "title": "World Leaders Finalize Landmark Clean Energy Transition Pact",
  "url": "https://www.reuters.com/sustainability/clean-energy-summit-2026-pact-signed",
  "content_availability": "full_text",
  "published_at": "2026-10-24T20:30:00+05:30",
  "retrieved_at": "2026-10-28T11:16:04.157828+05:30",
  "created_at": "2026-10-28T11:16:04.157831+05:30"
}
```

`GET /api/articles/{id}` returns the same fields plus `content`,
`canonical_url`, `content_hash` and `duplicate_of_article_id`.

Required by the frontend: `id`, `title`. The Content column shows
`content_availability` as **Full text**, **Summary only** or **Headline only**
(or "Not provided" if missing). The frontend does not use `event_id`,
`content_hash` or `duplicate_of_article_id` yet.

## News collection (RSS ingestion)

`POST /api/ingestion/run` (from `app/api/v1/endpoints/ingestion.py`). The
frontend sends an empty body `{}`, so the backend uses its own feed list
(`DEFAULT_RSS_FEEDS` in `app/core/config.py`, also at `GET /api/ingestion/feeds`).

Real reply (shortened):

```json
{
  "feeds_attempted": 5,
  "feeds_successful": 2,
  "articles_inserted": 50,
  "articles_skipped_duplicate": 0,
  "feed_errors": 3,
  "details": [
    { "source_name": "The Guardian", "feed_url": "https://www.theguardian.com/world/rss",
      "status": "success", "articles_inserted": 30, "articles_skipped_duplicate": 0, "error": null }
  ]
}
```

What the dashboard does with it:

- Shows the five counts (only the ones in the reply) and a table with one row
  per feed: name, **Success** / **Failed**, new, duplicates and the error text.
- Reloads Recent Articles and News Sources afterwards (a run can add sources).
- Waits up to **2 minutes** (`INGESTION_TIMEOUT_MS`), because the backend reads
  every feed before it answers. Other requests still wait 10 seconds.
- Is **turned off in mock mode**, because a run saves real articles while the
  pages would keep showing sample data.
- Keeps the result only until the user leaves the page: the backend does not
  store a history of runs. Source feed status is not shown for the same reason.

### Seen during the real run (for Person A)

- Reuters: `https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best`
  redirects and then returns **404**, so that feed URL in `DEFAULT_RSS_FEEDS` needs changing.
- BBC News and NPR News failed with "Connection reset by peer" on this test
  network; they may work on another network.

## Error handling in the frontend

| Situation | What the user sees |
| --------- | ------------------ |
| Backend off, wrong address, or CORS blocked | "Could not reach the backend at …" + Try again |
| No answer after 10 seconds | "The backend took too long to respond." |
| Route does not exist (FastAPI `{"detail":"Not Found"}`) | "The backend has no route /api/… (HTTP 404) …" |
| Other error with `{"detail": ...}` | The `detail` text and the status code |
| Error without JSON (e.g. HTML 500 page) | "The backend returned an error (HTTP 500)." |
| Success but broken JSON or wrong shape | "…unexpected format" / "not valid JSON" |

## Not covered

Semantic matching, AI analysis, comparison reports and ingestion history.
