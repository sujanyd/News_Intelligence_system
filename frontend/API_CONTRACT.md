# Frontend ↔ Backend Contract (Articles, Sources, Stories and Events)

## Integration status (updated 5 Nov 2026)

| What | Status |
| ---- | ------ |
| Frontend reaches the backend (`GET /health`) | ✅ Works (tested against the real FastAPI app) |
| CORS for the Vite dev server | ✅ Works (`allow_origins=["*"]` in `app/main.py`) |
| `GET /api/sources`, `POST /api/sources`, `GET /api/sources/{id}` | ✅ **Implemented & tested** (also mounted at `/api/v1/sources`) |
| `GET /api/articles` (+ `source_id`, `limit`, `offset`), `GET /api/articles/{id}`, `POST /api/articles` | ✅ **Implemented & tested** (also mounted at `/api/v1/articles`) |
| `POST /api/ingestion/run`, `GET /api/ingestion/feeds` | ✅ **Implemented** by Person A; the dashboard's **Run News Collection** button uses `POST /api/ingestion/run` |
| Stories and events (`/api/stories…`, `/api/events…`) | ✅ **Implemented** by Person A (commit `3bd8623`) and checked on 5 Nov 2026; used by the **Stories** page (see [Stories and events](#stories-and-events)) |

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

### Article matching demo check (5 Nov 2026)

Backend in Person A's standalone demo mode (SQLite, in-memory Qdrant, mock
embeddings), 86 articles (seed data plus one real news collection run) and 168
embeddings generated through `POST /api/embeddings/generate`:

| Feature | Result |
| ------- | ------ |
| Dashboard, Sources, Articles pages | ✅ Real data, no errors |
| Article details → Similar Articles | ✅ 5 nearest articles with similarity %, each with its stored label or "Not classified yet" |
| "Classify these articles" | ✅ `POST /api/articles/{id}/match` (5 candidates, no cutoff); 4 cards went from "Not classified yet" to DIFFERENT |
| Comparisons → pick an article | ✅ `GET /api/articles/40/matches`: All 10, SAME 0, RELATED 1, DIFFERENT 9, with real titles and sources |
| Run matching (backend default cutoff 0.2) | ✅ "No candidate articles were found above the backend's similarity cutoff (0.2)" |
| Run matching with "Include low-similarity candidates" | ✅ "Classified 10 candidate articles: 0 new, 0 updated, 10 already stored." |
| Side-by-side comparison | ✅ Both articles' text, similarity 45%, confidence 67% |
| Backend unreachable | ✅ Error message, **Try again** recovers |
| Browser console | ✅ No errors or warnings |
| Phone layout | ✅ No sideways scrolling |

Notes for the demo:

- With `EMBEDDING_PROVIDER=mock` the vectors are not semantic, so similarity
  is low (about 5 to 7%) and most pairs are DIFFERENT. That is the backend's
  real output; the frontend shows it as it is. A real embedding model is
  needed for meaningful SAME / RELATED results.
- There is no route that lists **all** matches, so Comparisons asks for one
  article first.
- There is no route for saving a manual review, so the review panel stays
  read-only.
- `docs/demo-readiness/FRONTEND_BACKEND_INTEGRATION.md` lists
  `/api/articles/{id}/similar`, which does not exist; the real route is
  `/api/similarity/article/{id}`. `RUN_PROJECT.md` mentions
  `scripts/seed_demo_data.py`, which is not in the repository.

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
| `fetchArticleEmbeddings(id)` | GET | `/api/embeddings/article/{article_id}`     |
| `fetchSimilarArticles(id)` | GET | `/api/similarity/article/{article_id}?embedding_type=headline&limit=5` |
| `fetchMatches({ articleId })` | GET | `/api/articles/{article_id}/matches?limit=100` (+ `label`) |
| `runArticleMatching(id)` | POST | `/api/articles/{article_id}/match` with `{ candidate_limit, score_threshold? }` |
| `fetchMatch(id)`    | GET    | `/api/matches/{match_id}`                        |

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

## Stories and events

A **story** is one news topic that keeps going (for example a trial).
An **event** is one thing that happened inside that story. Each article
belongs to at most one event (`event_id` on the article), so it also belongs
to that event's story.

```text
Story  ──has many──▶  Event  ──has many──▶  Article
```

Person A added these routes in commit `3bd8623` (5 Nov 2026). Like the other
routes, they work under both `/api` and `/api/v1`. The **Stories** page
uses them (see "What the Stories page calls" below); this section records
what the backend really sends.

### Routes the Stories pages would use

| What the page needs | Route | Reply |
| ------------------- | ----- | ----- |
| Stories list | `GET /api/stories?skip=&limit=` | Array of **Story** (newest first) |
| One story | `GET /api/stories/{id}` | **Story** + `events` (array of **Event**) + `articles` (array of **Article summary**) |
| Events of a story | `GET /api/stories/{id}/events` | Array of **Event** (oldest `event_time` first) |
| Articles of a story | `GET /api/stories/{id}/articles` | Array of **Article summary** (newest first) |
| Events list | `GET /api/events?story_id=&skip=&limit=` | Array of **Event** (newest `event_time` first) |
| One event | `GET /api/events/{id}` | **Event** + `story_title` + `articles` (array of **Article summary**) |
| Articles of an event | `GET /api/events/{id}/articles` | Array of **Article summary** (newest first) |
| Put articles into stories | `POST /api/stories/group/batch?limit=` (1 to 200, default 50) | Array of **Grouping result**, one per article |
| Put one article into a story | `POST /api/stories/group` with `{"article_id": 40, "force_regroup": false}` | One **Grouping result** |

The backend also has `POST /api/stories` and `POST /api/events` for creating
them by hand. The frontend does not need them.

**Paging uses `skip`, not `offset`.** `GET /api/articles` uses `offset`, but
these two lists use `skip` (`limit` is 1 to 100, default 50). An `offset`
value is silently ignored, so the frontend must send `skip`.

### What the Stories page calls

| View | Calls |
| ---- | ----- |
| Stories list | `GET /api/stories?limit=11&skip=…` (10 per page; the 11th says there is a next page), then `GET /api/stories/{id}` for each story on the page to list its sources |
| "Group articles" button | `POST /api/stories/group/batch?limit=200` (waits up to 2 minutes), then reloads the list |
| Story details | `GET /api/stories/{id}` |
| Event details | `GET /api/events/{id}`; "View" on an article uses `GET /api/articles/{id}` |

Not used: `GET /api/stories/{id}/events`, `GET /api/stories/{id}/articles`,
`GET /api/events`, `GET /api/events/{id}/articles` (the detail replies already
contain the same data), and the two create routes.

In mock mode (`VITE_USE_MOCK_DATA=true`) the page shows "Stories need the
real backend" and calls nothing. There are no sample stories, so nothing made
up is ever shown.

### Reply shapes (real replies, 5 Nov 2026)

**Story** (`GET /api/stories`):

```json
{
  "id": 1,
  "title": "Global Clean Energy Summit 2026",
  "created_at": "2026-11-05T02:37:03.327629",
  "event_count": 1,
  "article_count": 1
}
```

**Event** (inside `GET /api/stories/{id}`, and `GET /api/events`):

```json
{
  "id": 1,
  "story_id": 1,
  "event_time": "2026-10-24T14:30:00",
  "event_time_precision": "exact",
  "event_time_disagreement": false,
  "article_count": 1
}
```

- `event_time` can be `null`.
- `event_time_precision` is one of `exact`, `date`, `range`, `unknown`.
- `event_time_disagreement` is `true` when sources give different times.
- `GET /api/events/{id}` adds `story_title` and `articles`.

**Article summary** (inside story and event replies): the same fields as an
article in `GET /api/articles`: `id`, `source_id`, `source_name`,
`event_id`, `title`, `url`, `content_availability`, `published_at`,
`retrieved_at`, `created_at`.

**Grouping result** (`POST /api/stories/group`):

```json
{
  "article_id": 40,
  "story_id": 2,
  "story_title": "Beau Lamarre-Condon trial live updates: …",
  "story_action": "created",
  "event_id": 2,
  "event_action": "created",
  "reason": "No suitable existing story found …",
  "matched_article_id": null
}
```

`story_action` and `event_action` are `"created"` or `"reused"`.

**Errors:** an unknown id returns `404` with
`{"detail": "Story with ID 999 does not exist."}` (or `Event with ID …`).
A `limit` above 100 returns `422`.

### What the backend does not send

The Stories task asks for some things the backend has no field for. The
frontend must not invent them:

| Asked for | What exists instead |
| --------- | ------------------- |
| Story description | Nothing. A story has only `id`, `title`, `created_at` and the two counts. |
| Event title or description | Nothing. An event has only an id, its time fields and `article_count`. The page can label it "Event 48" and show its articles' headlines. |
| Sources on the Stories list | Not in `GET /api/stories`. `GET /api/stories/{id}` has `source_name` on each article, so the **details** page can list the sources. |

### Checked against the real backend (5 Nov 2026)

Backend at commit `3bd8623`, on a copy of the demo database (84 collected
articles, SQLite, mock embeddings). `pytest`: 144 passed, 1 skipped.

- Before grouping: 1 story and 1 event, both from the seed script.
- News collection does **not** group articles. Nothing calls the grouping
  code except the two `POST /api/stories/group…` routes, so new articles stay
  out of every story until someone calls one of them.
- `POST /api/stories/group/batch?limit=100` grouped every article in one call.
  Result: **67 stories** for 84 articles. Most stories have 1 article; the
  largest has 5 articles, all from The Guardian, each in its own event.
- Unknown story or event ids returned `404` as described above.

**Stories page in the browser** (same backend, fresh copy of the database):
"Group articles" answered "Grouped 83 articles: 65 new stories, 18 added to
existing stories, 83 new events." The list then showed 10 stories per page
with their sources. Opening the story with 4 events, one of its events, and
an article from that event all worked, as did both back buttons. With the
backend stopped, the list showed "Could not load stories" and "Try again".
No console errors; no sideways scrolling at phone width (375 px).

The list page sends one extra request per story (10 per page) only to show
sources; question 5 below would remove them.

### Open questions for Person A

1. **`event_time` is the publishing time.** Grouping copies the article's
   `published_at` into `event_time` and marks it `exact`.
   `docs/STORY_EVENT_GROUPING.md` says these should stay separate. Should the
   page show it as "when it happened", or should the precision be something
   other than `exact` until the real time is known?
2. **No publish date means "now".** An article without `published_at` gets
   the current time as `event_time`, with precision `unknown`. Could
   `event_time` stay `null` in that case?
3. **When should grouping run?** Should news collection call it, or should
   the frontend have a "Group articles" button that calls
   `POST /api/stories/group/batch`?
4. **`skip` or `offset`?** Could the story and event lists also accept
   `offset`, like `GET /api/articles`?
5. **Source names on the list.** Could `GET /api/stories` include
   `source_names` (a list of names), so the Stories page can show sources
   without loading every story?

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

AI analysis (bias and framing), comparison reports, saving manual match reviews and ingestion history.
