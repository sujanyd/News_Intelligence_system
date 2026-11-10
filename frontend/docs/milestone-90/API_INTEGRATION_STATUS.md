# API Integration Status (Milestone 90%)

Checked on 10 Nov 2026 against the backend at `5d6530c` (main). "Seen" means
the request was made by the running frontend during the browser test and
answered with 200/201 (network log).

## Used by the frontend

| Area | Route | Used by | Seen |
| ---- | ----- | ------- | ---- |
| Health | `GET /health` | Dashboard "Check Backend Status" | — |
| Sources | `GET/POST /api/sources`, `GET /api/sources/{id}` | Sources, Dashboard | ✅ |
| Articles | `GET /api/articles?limit&offset&source_id`, `GET /api/articles/{id}` | Articles, Dashboard, details, totals | ✅ |
| Ingestion | `POST /api/ingestion/run`, `GET /api/ingestion/feeds` | Dashboard, Sources | feeds ✅ |
| Embeddings / similarity | `GET /api/embeddings/article/{id}`, `GET /api/similarity/article/{id}` | Processing status, Similar articles | ✅ |
| Matching | `GET /api/articles/{id}/matches`, `POST …/match`, `GET /api/matches/{id}` | Similar articles labels, pairwise matching | ✅ |
| Stories / events | `GET /api/stories`, `/stories/{id}`, `GET /api/events`, `/events/{id}`, `POST /api/stories/group/batch` | Stories, Dashboard, Comparisons | ✅ |
| Insights | `GET /api/articles/{id}/extraction`, `POST …/extract` | Article Insights, comparisons, reports | ✅ |
| Tone and framing | `GET /api/articles/{id}/tone-framing` | Tone and Framing, comparisons, reports | ✅ |
| Political | `GET /api/articles/{id}/political-signals` | Political Analysis, comparisons, reports | ✅ |
| **AI detection** (new) | `GET /api/articles/{id}/ai-detection`, `POST …/ai-detection/analyze` | AI Detection section | GET ✅ |
| **Comparisons** (new) | `GET /api/comparisons?limit&offset`, `GET /api/comparisons/{id}`, `POST /api/comparisons` | Dashboard count, Comparisons, Reports | ✅ (POST 201) |
| **Reports** (new) | `GET /api/reports?limit&offset`, `GET /api/reports/{id}`, `POST /api/reports/generate` | Dashboard count, Reports, Comparisons | ✅ (POST 201) |

## Exist but not used

| Route | Why |
| ----- | --- |
| `GET /api/comparisons/{id}/evidence`, `/coverage` | Same data is in `GET /comparisons/{id}` |
| `GET /api/comparisons/{id}/political-signals` | Sends left/right leaning only; not shown on purpose |
| `GET /api/articles/ai-detection/flagged` | No page for flagged articles yet (see REMAINING_WORK.md) |
| `POST /api/articles/{id}/detect-duplicates` | No duplicate view yet |
| `/topics`, `/entities`, `/facts`, `/quotes`, `/tone`, `/headline-framing`, `/framing-signals`, `/political-entities`, `/political-evidence`, story/event sub-lists | Same data in the combined routes |

## Missing in the backend

| Needed by the task | Frontend now |
| ------------------ | ------------ |
| Headline tone | Says "Not measured on its own" in the tone section |
| Fact agreement across articles ("common facts", "differing claims") | Facts side by side with a note that agreement is not checked |
| Count routes | Lists read page by page (cap 2,000) |
| Ingestion history | Not shown |
| Report export as a file | The frontend saves the backend's own report text (`content`) as a file; there is no export route |

## Request efficiency

- One shared extraction request per article when its three analyses load
  together (checked in the network log: 1 extraction call).
- In development, React's StrictMode runs effects twice, so some GETs appear
  twice in the dev network log; production builds do not do this.
