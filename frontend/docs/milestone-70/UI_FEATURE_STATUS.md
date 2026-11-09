# UI Feature Status

After the milestone (9 Nov 2026). "Real data" means the screen was seen
working against the real backend in the browser.

| # | Feature (task section) | Status | Real data | Notes |
| - | ---------------------- | ------ | --------- | ----- |
| 1 | Dashboard: totals, sources, stories/events, recent articles | ✅ Complete | Yes | Totals are counted by reading the lists (no count route). "Comparisons completed" replaced by "Comparable stories" (stories with 2+ articles), because the backend stores no comparisons. |
| 1 | Dashboard: ingestion status | ⚠️ Partial | Yes | Run button and its result work; the backend does not store past runs. |
| 2 | Sources, RSS feeds, add source | ✅ Complete | Yes | RSS feed list is new. |
| 3 | Article list, search, source filter, refresh | ✅ Complete | Yes | Search covers the newest 100 articles only. |
| 3 | Article details, publisher, publication info | ✅ Complete | Yes | |
| 3 | Similar articles, SAME / RELATED / DIFFERENT, similarity and confidence separate | ✅ Complete | Yes | |
| 4 | Stories → story → events → articles, event time and precision | ✅ Complete | Yes | |
| 5 | Insights: topics, people, organizations, places, facts, quotes and speakers | ✅ Complete | Yes | |
| 6 | Tone, headline framing, framing signals, evidence, confidence | ✅ Complete | Yes | |
| 6 | Headline tone | ❌ Missing | — | Not in the backend. |
| 7 | Political entities, presentation signals, evidence, differences between articles | ✅ Complete | Yes | Leaning and fixed confidence values hidden on purpose. |
| 8 | Cross-source comparison of a story: headlines, framing, tone, shared and missing names (coverage gaps), facts, political coverage | ✅ Complete (new) | Yes | Compares two articles chosen by the user. Facts are side by side; agreement between facts is not checked (no backend support). |
| 9 | Reports: list, open, summary, events, publishers, coverage table, framing differences, shared/missing coverage, evidence, limitations | ✅ Complete (new) | Yes | Built in the browser from backend data; no report route. |
| 9 | Report download / export | ❌ Missing | — | No backend export; no fake button. |
| — | AI-generated content detection | ❌ Missing | — | "Coming soon" card; no backend. |
| — | URLs per page (bookmarks, browser back button) | ❌ Missing | — | Navigation is state only. |

## Workflow from the task

Dashboard → News Sources → Articles → Article Details → Similar Articles and
Classification → Story and Event Exploration → Extracted Insights → Tone and
Framing → Political Signals → Cross-Source Comparison → Reports:
**every step works with real backend data** (see FRONTEND_TEST_REPORT.md).
