import { formatDate } from './formatDate'

// What each event_time_precision value means, in plain words
export const PRECISION_LABELS = {
  exact: 'Exact time',
  date: 'Date only',
  range: 'Approximate',
  unknown: 'Unknown',
}

/**
 * Turns an event's time into readable text, using how precise the backend
 * says it is (event_time_precision):
 *
 *   exact   -> "24 Oct 2026, 8:00 pm"
 *   date    -> "24 Oct 2026"           (the hour is not known)
 *   range   -> "Around 24 Oct 2026"
 *   unknown -> "Not known"             (even if a time was sent, it is not trusted)
 *
 * @param {{ event_time: string | null, event_time_precision: string }} event
 * @returns {string}
 */
export function formatEventTime(event) {
  const { event_time: time, event_time_precision: precision } = event
  if (!time || precision === 'unknown') {
    return 'Not known'
  }

  const dateOnly = new Date(time).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (precision === 'date') return dateOnly
  if (precision === 'range') return `Around ${dateOnly}`
  return formatDate(time)
}

/**
 * Lists each source name once, in A to Z order.
 * Articles without a source name are skipped.
 *
 * @param {Array<{ source_name: string | null }>} articles
 * @returns {Array<string>}
 */
export function getUniqueSourceNames(articles) {
  const names = new Set()
  for (const article of articles) {
    if (article.source_name) names.add(article.source_name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * Sorts events from earliest to latest. Events without a known time go last.
 */
export function sortEventsByTime(events) {
  const timeOf = (event) =>
    event.event_time && event.event_time_precision !== 'unknown'
      ? new Date(event.event_time).getTime()
      : Infinity
  return [...events].sort((a, b) => timeOf(a) - timeOf(b) || a.id - b.id)
}
