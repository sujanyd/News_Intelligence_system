# Frontend ↔ Backend Contract (Articles and Sources)

## Integration status (updated 27 Oct 2026)

| What | Status |
| ---- | ------ |
| Frontend reaches the backend (`GET /health`) | ✅ Works (tested against the real FastAPI app) |
| CORS for the Vite dev server | ✅ Works (`allow_origins=["*"]` in `app/main.py`) |
| `GET /api/sources`, `POST /api/sources`, `GET /api/sources/{id}` | ✅ **Implemented & tested** (also mounted at `/api/v1/sources`) |
| `GET /api/articles` (+ `source_id`, `limit`, `offset`), `GET /api/articles/{id}`, `POST /api/articles` | ✅ **Implemented & tested** (also mounted at `/api/v1/articles`) |

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

### Open backend issue (for Person A)

`alembic upgrade head` fails with `Can't load plugin: sqlalchemy.dialects:driver`.
`alembic.ini` still has `sqlalchemy.url = driver://user:pass@localhost/dbname`,
and `alembic/env.py` only uses `settings.DATABASE_URL` when that line is empty.
Clearing the line (or always using the settings value) should fix it.
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

Pagination: the page shows 5 articles. It asks for `limit=6`, and if 6 come
back it knows there is a next page. `offset = (page - 1) × 5`.

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

Semantic matching, AI analysis and comparison reports.
