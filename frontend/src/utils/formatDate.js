/**
 * Turns a date string from the API (like "2026-10-26T08:30:00Z") into
 * readable text in the user's own time zone, e.g. "26 Oct 2026, 2:00 pm".
 *
 * @param {string | null} isoDate
 * @returns {string} readable date, or "Not available" when there is no date
 */
export function formatDate(isoDate) {
  if (!isoDate) {
    return 'Not available'
  }
  return new Date(isoDate).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
