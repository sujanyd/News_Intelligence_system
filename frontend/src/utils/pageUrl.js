// The pages the app has (the first one is the start page)
export const PAGE_NAMES = ['dashboard', 'articles', 'stories', 'sources', 'comparisons', 'reports']

/**
 * The URL hash for a page, so the browser's Back / Forward buttons and
 * reloading work.
 *
 *   pageToHash('dashboard')                              -> '#/dashboard'
 *   pageToHash('articles', { sourceId: 3 })              -> '#/articles?sourceId=3'
 *   pageToHash('stories', { name: 'event', eventId: 12 }) -> '#/stories?name=event&eventId=12'
 *
 * @param {string} tab
 * @param {Object | null} [params]
 * @returns {string}
 */
export function pageToHash(tab, params = null) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  }
  const queryText = query.toString()
  return queryText ? `#/${tab}?${queryText}` : `#/${tab}`
}

/**
 * The page a URL hash points to (the opposite of pageToHash).
 * Unknown or missing pages open the dashboard. Whole numbers come back as
 * numbers ("12" -> 12), because the pages use number IDs.
 *
 * @param {string} hash - e.g. window.location.hash
 * @returns {{ tab: string, params: Object | null }}
 */
export function hashToPage(hash) {
  const text = (hash || '').replace(/^#\/?/, '')
  const [tabText, queryText = ''] = text.split('?')
  const tab = PAGE_NAMES.includes(tabText) ? tabText : PAGE_NAMES[0]

  const params = {}
  for (const [key, value] of new URLSearchParams(queryText)) {
    params[key] = /^\d+$/.test(value) ? Number(value) : value
  }
  return { tab, params: Object.keys(params).length > 0 ? params : null }
}
