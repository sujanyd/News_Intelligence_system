# Frontend ↔ Backend Contract (Articles and Sources)

## Integration status (checked 27 Oct 2026)

| What | Status |
| ---- | ------ |
| Frontend reaches the backend (`GET /health`) | ✅ Works (tested in the browser against the real FastAPI app) |
| CORS for the Vite dev server | ✅ Works (`allow_origins=["*"]` in `app/main.py`) |
| `GET /api/sources`, `POST /api/sources`, `GET /api/sources/{id}` | ❌ **Not built**: backend returns 404 |
| `GET /api/articles` (+ `source_id`, `limit`, `offset`), `GET /api/articles/{id}`, `POST /api/articles` | ❌ **Not built**: backend returns 404 |

**Real integration is not complete.** The frontend client is ready and tested
against these planned routes, but it has not yet talked to working article or
source endpoints. Until then, run the frontend with `VITE_USE_MOCK_DATA=true`
to see the screens with sample data.

## Questions for Person A (backend)

1. **Path prefix**: the plan says `/api/...`, but `app/core/config.py` uses
   `API_V1_PREFIX="/api/v1"`. Which one will the routes use?
   (Frontend setting: `VITE_API_PREFIX`, no code change needed.)
2. **List format**: will `GET /api/articles` return a plain array, or
   `{"items": [...], "total": 42}`? The frontend accepts both; with `total`
   it can show "Page 2 of 9".
3. **Article list fields**: will each article include `source_name`? If not,
   the frontend looks the name up from `GET /api/sources`.
   Will the list include `content`? If not, the table shows "Not in list"
   and the full text is loaded from `GET /api/articles/{id}`.
4. **Errors**: will errors use FastAPI's default `{"detail": ...}`?
   What status for a duplicate source name? (Frontend expects `409`.)
5. **Required fields**:
   - Create source: `name`, `base_url`?
   - Create article: `source_id`, `title`, `content`, `url` (all `NOT NULL`
     in the model), plus optional `published_at` and `event_id`?
6. **Limits**: is there a maximum `limit`? The frontend asks for 6 at a time.
7. **CORS**: keep `allow_origins=["*"]` for development; for deployment,
   list the real frontend address instead.

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

### Article

```json
{
  "id": 101,
  "source_id": 1,
  "title": "City council approves new budget for public transport",
  "url": "https://dailyledger.example/news/transport-budget",
  "published_at": "2026-10-26T08:30:00Z",
  "retrieved_at": "2026-10-26T09:00:00Z",
  "content": "The city council voted on Monday..."
}
```

Required by the frontend: `id`, `title`. Optional: everything else
(`source_name` too, if the backend wants to add it).

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
