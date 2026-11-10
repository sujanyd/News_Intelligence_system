# UI Limitations (Milestone 90%)

## What the screens can and cannot claim

| Screen | Limitation, as shown to the user |
| ------ | -------------------------------- |
| Tone and framing | Word-list matches; tone is not bias; confidence comes from fixed rules; headline tone is not measured on its own. |
| Political analysis | Word-list matches near a name; left/right leaning is never shown; one article says nothing about a publisher's politics. |
| AI detection | A statistical estimate from sentence lengths and repeated words, **not proof**; confidence reflects text length only; often only a feed summary is checked; too little text → "not enough text". |
| Comparisons | "Text length score" measures length, not coverage; backend observations are sentences written by the backend, not quotes; "in only some articles" is not proof of omission; facts are not matched across articles. |
| Reports | Backend report text includes a "leaning" per publisher, flagged on the page as not evidence; the structured view leaves it out. |

## Technical limitations

- **No URLs per page:** pages cannot be bookmarked, and the browser's back
  button leaves the app. Navigation between pages uses an in-app context.
- **Totals** are counted by reading lists page by page (at most 2,000 items,
  then "2000+").
- **Search** only covers the newest 100 articles (no backend search).
- A comparison or report analyses **at most 8 articles** in the detailed
  sections (each needs three requests).
- **Duplicate GETs in development** come from React's StrictMode; production
  builds send each request once.
- The demo data is thin: after grouping only **2 of 66 stories** have articles
  from two publishers, so most comparisons are single-publisher (the page says
  so).
- With the mock embedding provider used in testing, similarity scores and
  story grouping are not meaningful (e.g. a US–Israel article grouped under a
  Zelenskyy story). Real semantic embeddings (`77f56ae`) were not tested.
