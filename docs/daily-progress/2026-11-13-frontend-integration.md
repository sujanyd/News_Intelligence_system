# Frontend Integration — 13 November 2026

Owner: Person B (frontend). Branch: `ui/visual-refresh`, starting from `main` at `3f993bf`.
No backend file was changed. Person A's PostgreSQL, persistent Qdrant and RSS
scheduling work had not reached `main` when this was written.

Testing has **not** started; it begins on 14 November. The checks below are
one look at the app in a browser, not tests, and no test suite was run.

## 1. Set-up used for the checks

To see the frontend against a PostgreSQL-backed backend without touching
Person A's files, Person A's unchanged code (`main` at `3f993bf`) was run locally
with environment variables only:

| Part | Setting |
| --- | --- |
| Database | PostgreSQL 16 in a local Docker container (port 5433) |
| Embeddings | `EMBEDDING_PROVIDER=sentence-transformers` (`all-MiniLM-L6-v2`, 384 dimensions) |
| Qdrant | file storage (`QDRANT_URL=""`, `QDRANT_PATH` set to a local folder) |
| Frontend | Vite dev server, then a production build served by `vite preview` |

Data came only from the real pipeline, with nothing seeded by hand:

- one news collection inserted 82 articles from 4 feeds;
- embeddings were generated for those articles;
- each article was matched against the others;
- the articles were grouped into stories (25 stories, 50 events);
- one comparison and one report were made through the UI.

## 2. Findings for Person A (backend, not changed by Person B)

1. **Alembic migration fails on PostgreSQL.**
   - Running `alembic upgrade head` stops with `value too long for type character varying(32)`.
     The revision id `0002_remaining_tables_and_constraints` is 37 characters, longer than
     Alembic's `alembic_version.version_num` column.
   - SQLite does not check the length, so this was not seen before.
   - PostgreSQL rolls the whole migration back, so no tables are created.
   - For the frontend check, the tables were made with Person A's `python -m app.db.init_db`
     instead (21 tables).
   - Fix idea: a revision id of 32 characters or fewer.
2. **The Reuters feed returns HTTP 404**
   (`https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best`), so every
   collection run reports one feed error and Reuters never becomes a source.
3. **The dashboard summary sends `qdrant_mode: ""` in file or server mode.**
   `app/api/v1/endpoints/dashboard.py` only reports `QDRANT_URL`. The frontend now says
   "not reported by the backend" instead of hiding it.
4. **There is no route for ingestion status or the last run.**
   - `POST /ingestion/run` returns the result of the run it starts.
   - `GET /ingestion/feeds` lists the feeds.
   - Nothing reports earlier or scheduled runs. If the scheduler adds such a route, the
     frontend can show it.
5. **Extraction quality (seen, not measured):** on short BBC summaries,
   "says it" was listed as a person and as a political entity, and topics such as
   "The Ukrainian President Makes Sense" appeared. The frontend shows what the backend
   sends, so this is a backend quality point.

## 3. What changed in the frontend today

| Task | Change | Files |
| --- | --- | --- |
| Ingestion status (3) | The News Collection card shows **Last article collected**, the newest `retrieved_at` among the 100 most recently published articles. It reloads after each run and says that the backend keeps no run history. | `IngestionPanel.jsx`, `newsApi.js` (`fetchLatestCollectionTime`) |
| Ingestion status (3) | The run result also shows **Feed retries** (`feed_retries`, a field the backend already sent and the frontend dropped). | `normalize.js` |
| Navigation (7) | The open page and its settings are in the address (`#/articles?sourceId=3`, `#/stories?name=event&eventId=12`). The browser's Back and Forward buttons now move between pages, a reload keeps the page, and links can be shared. Unknown addresses open the Dashboard. | `App.jsx`, `utils/pageUrl.js` (new) |
| Dashboard (2) | The "Semantic engine" line says "Qdrant storage: not reported by the backend" when the backend sends an empty mode. | `Dashboard.jsx` |
| Configuration (10) | Out-of-date comments said the `/api` prefix was only "planned". They now say the backend serves `/api` and `/api/v1`, and how to point the app at a deployed backend. | `api/config.js`, `.env.example` |

## 4. What was checked (one look each, not tests)

| Task | What was seen |
| --- | --- |
| 1. Real backend data | Every page loaded real data from the PostgreSQL-backed backend. No "Coming soon", sample or made-up data was found outside mock mode (code search and browser). |
| 2. Dashboard on PostgreSQL | Totals matched `GET /dashboard/summary`: 82 articles, 4 sources, 25 / 50 stories / events, 9 comparable stories. The semantic engine line showed `sentence-transformers · 384-dimensional embeddings`. |
| 3. Collection status | "Last article collected" showed the real collection time. The run result shows the backend's own counts. |
| 4. Articles, sources, stories, events | Sources showed per-source counts; "View articles" opened Articles filtered to that source. "Event N" opened the event; "Back to story" and "All stories" worked. "Not grouped" and "Not classified" were checked against PostgreSQL and are correct (32 articles have no event, some have no stored match). |
| 5. AI detection, insights, comparisons, reports | One article opened from a report showed all 8 sections with real data. A comparison of 7 articles was saved, a Markdown report was generated from it, opened, and offered for download. |
| 6. Fake data | None found in normal workflows. |
| 7. Navigation | In-app links and back buttons worked. Browser Back / Forward and deep links work after today's change. The mobile menu opens, navigates and closes. |
| 8. Loading / error / empty states | With the backend stopped, every page showed a clear error ("Could not reach the backend at ...") with a "Try again" button and no endless spinner. Empty states were seen for comparisons and reports before any existed. |
| 9. Layout and themes | At 375 px wide, in both light and dark mode, no page scrolls sideways and tables become stacked cards. |
| 10. Configuration | A production build with `VITE_API_BASE_URL=http://127.0.0.1:8001` and `VITE_API_PREFIX=/api/v1`, served from another origin, loaded data from `/api/v1` and opened a deep link. |

After the backend was restarted, the PostgreSQL data was still there, and
similar articles still came from the file-backed Qdrant without new embeddings.
That was one look, not the restart verification Person A owns.

## 5. Known limits and small points left

- "Last article collected" is a stand-in: the backend sorts articles by publication time
  and keeps no run history.
- Inside a page (for example opening a story from the list), the address does not change.
  Back returns to the previous page, not to the previous view inside it.
- On phones, the closed menu drawer is moved off screen but its links can still be reached
  with the keyboard.
- The limits listed on 12 November still apply:
  - no source status;
  - headline tone is not measured separately;
  - the match split covers the 10 newest articles;
  - search and sort work on the newest 100 articles;
  - match reviews cannot be saved.
- The three backend gaps from 12 November are unchanged: entity aliases,
  event-time extraction, and the event timeline.

## 6. Testing (14 November)

- No test suite was run today and no test is claimed to pass.
- Add tests for `utils/pageUrl.js` (`pageToHash`, `hashToPage`), Back / Forward in
  `App.jsx`, `fetchLatestCollectionTime` and the "Last article collected" line.
- Check that existing tests which render `App` still start on the Dashboard (the address
  is now read on start).
- Repeat the checks above on Person A's final PostgreSQL, Qdrant and scheduler set-up.
