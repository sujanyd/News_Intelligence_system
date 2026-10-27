# Frontend ↔ Backend Data Contract (Articles and Sources)

**Status: PROPOSED. Not built in the backend yet.**

The backend currently has only `GET /health`. The Articles and Sources pages
run on mock data (`src/mocks/mockData.js`) until the endpoints below exist.
This file is for agreeing on the data shapes with Person A (backend).

The field names follow the existing database models in
`app/models/article.py` and `app/models/news_source.py`.

## Where the frontend calls the API

All calls are in `src/api/newsApi.js`. The pages never call `fetch` directly.

| Function          | Method | Proposed path       |
| ----------------- | ------ | ------------------- |
| `fetchArticles()` | GET    | `/api/v1/articles`  |
| `fetchSources()`  | GET    | `/api/v1/sources`   |
| `createSource()`  | POST   | `/api/v1/sources`   |

If Person A picks different paths, only `ENDPOINTS` in `newsApi.js` needs to change.

## Source object

```json
{
  "id": 1,
  "name": "Daily Ledger",
  "base_url": "https://dailyledger.example",
  "created_at": "2026-10-01T09:00:00Z"
}
```

| Field        | Type            | Notes                                   |
| ------------ | --------------- | --------------------------------------- |
| `id`         | integer         | Primary key                             |
| `name`       | string (≤ 255)  | Required, must be unique                |
| `base_url`   | string (≤ 512)  | Required, starts with `http://` or `https://` |
| `created_at` | ISO 8601 string | Set by the server                       |

### `GET /api/v1/sources`

Returns a JSON **array** of source objects.

### `POST /api/v1/sources`

Request body:

```json
{ "name": "Daily Ledger", "base_url": "https://dailyledger.example" }
```

- Success: `201`, returns the saved source object.
- Name already used: `409`.
- Missing or invalid field: `422` (FastAPI default).

## Article object

```json
{
  "id": 101,
  "source_id": 1,
  "source_name": "Daily Ledger",
  "title": "City council approves new budget for public transport",
  "url": "https://dailyledger.example/news/transport-budget",
  "published_at": "2026-10-26T08:30:00Z",
  "retrieved_at": "2026-10-26T09:00:00Z",
  "content": "The city council voted on Monday..."
}
```

| Field          | Type                    | Notes                                              |
| -------------- | ----------------------- | -------------------------------------------------- |
| `id`           | integer                 | Primary key                                        |
| `source_id`    | integer                 | Used by the source filter                          |
| `source_name`  | string                  | **Extra field** (from the joined source), shown in the table |
| `title`        | string                  | Used by the title search                           |
| `url`          | string                  | Link to the original article                       |
| `published_at` | ISO 8601 string or null | Shown as "Not available" when null                 |
| `retrieved_at` | ISO 8601 string         | When our pipeline fetched it                       |
| `content`      | string or null          | Empty or null is shown as "Missing" content        |

### `GET /api/v1/articles`

Returns a JSON **array** of article objects, newest first.

For now the frontend does search, source filtering and pagination itself.
If the article list becomes large, we can add query parameters later
(for example `?search=&source_id=&page=&page_size=`), agreed with Person A.

## Errors

Any non-2xx response is shown on the page as an error message with a
"Try again" button. No other error format is assumed.

## Not covered here

Semantic matching, AI analysis and comparison reports are not part of this
contract yet.
