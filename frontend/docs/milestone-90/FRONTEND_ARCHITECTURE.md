# Frontend Architecture (Milestone 90%)

React 19 + Vite 8. Tests: Vitest and Testing Library. Lint: oxlint.
Everything from the 70% architecture still holds (see
`../milestone-70/FRONTEND_ARCHITECTURE.md`); this page lists what changed.

## Data flow (unchanged)

```text
Component → one function in src/api/newsApi.js → client.js (fetch, timeout, ApiError)
                                                → normalize.js (checks the reply)
          → LoadingState / AlertMessage with "Try again" / EmptyState / data
```

- No `fetch` in components; every reply is checked; errors are shown, never hidden.
- Features without sample data show "needs the real backend" in mock mode.
  New flags: `COMPARISONS_AVAILABLE`, `AI_DETECTION_AVAILABLE`.

## New in this milestone

### Navigation between pages

`src/navigation.js` exports `NavigationContext`. `App.jsx` provides
`navigate(tab, params)`:

| Call | Opens |
| ---- | ----- |
| `navigate('stories', { name: 'event', eventId })` | an article's event (button "Open its event and story" in the article details) |
| `navigate('reports', { reportId })` | a report just generated from a comparison |
| `navigate('comparisons')`, `navigate('reports')` | Dashboard card buttons |

The page receives the params as a prop (`initialView`, `initialReportId`,
`initialComparisonId`) and a `key`, so opening the same page with new params
starts it fresh. Without the context (in tests) the buttons are hidden.

### New components

| Component | Where | Backend |
| --------- | ----- | ------- |
| `AiDetectionSection` | Article details, section 9 | `GET/POST /articles/{id}/ai-detection` |
| `SavedComparisonList` | Comparisons | `GET /comparisons` |
| `ComparisonView` + `ComparisonBody` | Comparisons (and Reports reuses `ComparisonBody`) | `GET /comparisons/{id}`, `GET /events/{id}`, `POST /reports/generate` |
| `ReportView` | Reports | `GET /reports/{id}`, then its comparison |
| `CoverageAnalysis` | inside `ComparisonBody` | the three analyses of each article |

`CoverageAnalysis` replaces the 70% milestone's browser-built `StoryReport`;
its sections are the same, plus topics coverage, facts by article and quotes
in the evidence.

`StoryComparison` gained "Save these two as a comparison" and "Save all N
articles as a comparison" (`POST /comparisons`).

### New service functions (`newsApi.js`)

`fetchAllComparisons`, `fetchComparison`, `fetchComparisonWithEvent`,
`createComparison`, `fetchAllReports`, `fetchReport`, `generateReport`,
`fetchAiDetection`, `rerunAiDetection`.

New checks (`normalize.js`): `toComparisonSummary`, `toComparison`,
`toReport`, `toAiDetection`. Helpers: `utils/comparisonLabels.js`,
`utils/download.js`, `nameCoverage` in `utils/coverage.js`.

### Safety rules in the new code

- **Ordering safeguard:** `createComparison` runs each article's extraction
  before `POST /comparisons`, because the backend's comparison runs the
  political analysis (which would otherwise leave the article's insights empty).
- **One extraction request:** `fetchArticleAnalyses` starts insights, tone and
  political together so they share one in-flight extraction request.
- **Backend report HTML is never inserted** into the page (the backend does
  not escape titles). Report text is shown in a `<pre>` and downloaded as is.
- **Not shown on purpose:** comparison `political_leaning` / `slant_score`;
  AI likelihood when the backend had too little text (fixed 0.05 default).
- **Renamed honestly:** comparison `coverage_score` → "Text length score".
