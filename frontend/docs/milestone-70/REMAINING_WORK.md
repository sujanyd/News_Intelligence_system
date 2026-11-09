# Remaining Work (Frontend)

## Blocked by the backend (Person A)

| Item | Needed from the backend |
| ---- | ----------------------- |
| Report download / export | A report route and an export format |
| Saved reports and comparisons | Routes to create, list and open them |
| Headline tone | Tone of the headline on its own |
| Facts that agree or disagree across articles | Fact matching between articles |
| Ingestion history | The time and result of past collection runs |
| Faster totals | A count route, or `total` in list replies |
| Search over all articles | A search parameter on `GET /api/articles` |
| Insights kept when the political or tone analysis runs first | One shared analysis row (frontend has a safeguard; see `frontend/API_CONTRACT.md`) |
| Better analysis quality | Wrong entities seen in real data ("Middle East" as a person, "is expected" and "goes off" as politicians); framing cues without context ("bear attack" as conflict); fixed confidence values |
| AI-generated content detection | The whole feature |

## Frontend work that is not blocked

1. **URLs per page** (a router), so pages can be bookmarked and the browser
   back button works.
2. A report can analyse at most 8 articles; a bigger story needs paging or a
   backend report.
3. Compare more than two articles at once on the Comparisons page.
4. Open an article's details from the comparison and the report.
5. Manual check of error states against a stopped backend, and of the
   Comparisons page at phone width after choosing a story.
6. Accessibility review with a screen reader.

## Honest completion estimate

About **70%** of the frontend described in the milestone task. Every core
screen in the workflow works with real data, but reports and comparisons are
put together in the browser (not saved, no export), headline tone and AI
detection are missing, and there are no page URLs.
