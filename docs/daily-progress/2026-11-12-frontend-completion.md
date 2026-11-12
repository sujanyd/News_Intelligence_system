# Frontend Feature Completion — 12 November 2026

Owner: Person B (frontend). Branch: `ui/visual-refresh` (local, not pushed).

Out of scope today (reserved for 13 November): PostgreSQL deployment
verification, persistent Qdrant configuration, automated RSS scheduling.

## 1. Audit summary

All six pages (Dashboard, Articles, Stories, Sources, Comparisons, Reports)
were already connected to the real backend. The old AI detection "Coming soon"
placeholder had been replaced on 11 November with the real endpoint. No page
shows made-up results: features that only exist in the real backend show a
"needs the real backend" note in mock mode instead of sample data.

Gaps found and closed today:

| Area | Gap | Now |
| --- | --- | --- |
| Dashboard | No similar-article activity or SAME / RELATED / DIFFERENT distribution | New "Similar-Article Activity" panel |
| Dashboard | No AI detection total | New "Flagged for review" total |
| Sources | No article count, no newest article, no link to the source's articles | All three added |
| Articles | No sorting, no content or grouping filter, no story/event or match column, could not be opened from another page | All added |
| Similar articles | Match confidence not shown | Shown next to the label, apart from the similarity score |
| Insights | Headline framing explanation not shown | Shown ("Why: ...") |
| Stories / events | No publication timeline, no per-publisher list; story articles could not be opened | All added |
| Comparisons | Only "these two" or "all" articles could be saved | Articles can be ticked one by one (at least 2) |

## 2. Completed screens

- **Dashboard**: totals for articles, sources, stories / events, comparable
  stories, saved comparisons, reports and articles flagged for review; news
  collection; newest articles; similar-article activity; flagged articles.
  Every total has loading, error ("Could not count", retry) and mock-mode states.
- **News Sources**: name, base URL, article count, newest article with its
  publication time, date added, "View articles" (opens Articles filtered to
  that source), add-a-source form, RSS feed list.
- **Articles**: search, publisher filter, sort (newest, oldest, title,
  publisher), content filter, story/event filter, backend pagination, story /
  event link, stored SAME / RELATED / DIFFERENT counts per article. Detail view:
  headline, publisher, content or excerpt, source URL, publication time,
  entities, topics, facts, quotes, tone and framing, political presentation
  signals, similar articles, matching, AI-likelihood estimate.
- **Stories / events**: story overview, events (event time, precision, source
  disagreement), publishers with article counts, publication timeline, articles
  (readable in place).
- **Comparisons**: story picker (same-event grouping), article selection,
  side-by-side headline / tone / framing / facts / quotes, political
  presentation signals, saved comparisons with coverage and evidence.
- **Reports**: list, open, findings with evidence, source articles (readable in
  place and linked to the original), download of the backend's own report text
  in its format (Markdown / HTML / JSON).

## 3. Backend APIs integrated

Already integrated before today and still used: `/sources`, `/articles`,
`/articles/{id}`, `/embeddings/article/{id}`, `/similarity/article/{id}`,
`/articles/{id}/match`, `/articles/{id}/matches`, `/stories`, `/stories/{id}`,
`/stories/group/batch`, `/events`, `/events/{id}`, `/articles/{id}/extraction`,
`/articles/{id}/political-signals`, `/articles/{id}/tone-framing`,
`/articles/{id}/ai-detection`, `/articles/{id}/ai-detection/analyze`,
`/articles/ai-detection/flagged`, `/comparisons`, `/comparisons/{id}`,
`/reports`, `/reports/{id}`, `/reports/generate`, `/ingestion/run`,
`/ingestion/feeds`, `/health`.

Used in new ways today (no new routes were invented):

- `GET /articles?source_id=` read page by page → per-source article count and
  newest article (`fetchSourceActivity`).
- `GET /articles?limit=10` then `GET /articles/{id}/matches` for each →
  dashboard match distribution (`fetchRecentMatchActivity`).
- `GET /articles/ai-detection/flagged` read page by page → flagged total
  (`countFlaggedAiDetections`).

Not called separately on purpose: `/comparisons/{id}/evidence`,
`/comparisons/{id}/coverage` and `/comparisons/{id}/political-signals`, because
`GET /comparisons/{id}` already returns coverages, evidences and political
signals. The same goes for `/stories/{id}/events`, `/stories/{id}/articles` and
`/events/{id}/articles`, which `GET /stories/{id}` and `GET /events/{id}` already
include.

## 4. Components created or modified today

Created:

- `src/components/MatchActivityPanel.jsx`: dashboard similar-article activity.
- `src/components/ArticleMatchSummary.jsx`: the match counts in the article table.
- `src/components/CoverageTimeline.jsx`: `CoverageTimeline` and `PublisherList`.
- `src/utils/publishers.js`: `countPublishers`.
- `src/tests/FeatureCompletion.test.jsx`: tests for the new pieces.

Modified:

- `src/api/newsApi.js`: `fetchSourceActivity`, `fetchRecentMatchActivity`,
  `countFlaggedAiDetections`.
- `src/pages/Dashboard.jsx`, `src/pages/Sources.jsx`, `src/pages/Articles.jsx`, `src/App.jsx`.
- `src/components/SimilarArticleCard.jsx`, `src/components/SimilarArticlesSection.jsx`.
- `src/components/ToneFramingSection.jsx`.
- `src/components/StoryDetails.jsx`, `src/components/EventDetails.jsx`.
- `src/components/StoryComparison.jsx`.
- `src/styles/refresh.css`.

## 5. Remaining UI gaps (honest list)

These are limits of the current backend, so the frontend explains them
instead of inventing data:

1. **Source status**: the backend stores no status for a source, so none is shown.
2. **Headline tone**: the backend measures tone for the whole article only; the
   UI says "Not measured separately".
3. **Match distribution** covers the 10 newest articles only: there is no route
   that lists every match. The card says so.
4. **Search, sort and content / grouping filters** work on the newest 100
   articles: the backend has no search or sort options. The page says so.
5. **AI detection** only covers articles whose detection has already run (it
   runs when an article is opened). Estimates are never shown as proof.
6. **Match review** (accept or correct a SAME / RELATED / DIFFERENT label) is
   still off: the backend has no route to save a review.
7. **Report status**: reports are created synchronously, so there is no
   "pending" state to show; the page shows "Generating..." while the request runs.
8. **Per-source counts** cost one request per 100 articles per source. Fine
   for the current feeds, slow with very large databases.

## 6. Testing deferred to 14 November

The dedicated testing phase starts on 14 November. Today:

- The full test suite was **not** run.
- Only the new file `src/tests/FeatureCompletion.test.jsx` was run, to make
  sure the new tests themselves work (10 tests).
- Existing tests for the changed screens (Articles, Sources, Stories,
  Dashboard, ReportsComparison, SimilarArticles, ToneFraming) were inspected,
  not run. Some may need small updates on 14 November because the pages now
  show extra columns and sections.
- `npm run lint` and `npm run build` were run and finished without errors.
- The changed pages were opened once against the local backend (Dashboard,
  Sources → Articles, a story page). That is a look, not a test.

The frontend is **not** claimed to be tested.
