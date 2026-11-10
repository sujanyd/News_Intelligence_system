// Helpers that line up the analyses of several articles about one story.
// Used by the Comparisons page (two articles) and the Reports page (a story).
// They only count and group what the backend sent; they never add results.

// The most articles one report analyses (each needs 3 backend requests)
export const REPORT_ARTICLE_LIMIT = 8

// Names are compared without upper/lower case and extra spaces
function nameKey(name) {
  return String(name).trim().toLowerCase()
}

/**
 * Lines up two lists by name.
 *
 * @param {Array} listA
 * @param {Array} listB
 * @param {(item) => string} [getName]
 * @returns {{ shared: Array<{ name, a, b }>, onlyA: Array, onlyB: Array }}
 */
export function compareByName(listA, listB, getName = (item) => item.name) {
  const byNameB = new Map(listB.map((item) => [nameKey(getName(item)), item]))
  const namesA = new Set(listA.map((item) => nameKey(getName(item))))
  const shared = []
  const onlyA = []
  for (const itemA of listA) {
    const itemB = byNameB.get(nameKey(getName(itemA)))
    if (itemB) shared.push({ name: getName(itemA), a: itemA, b: itemB })
    else onlyA.push(itemA)
  }
  const onlyB = listB.filter((item) => !namesA.has(nameKey(getName(item))))
  return { shared, onlyA, onlyB }
}

/**
 * The two articles to compare first: the first two from different
 * publishers, or simply the first two when one publisher wrote them all.
 *
 * @param {Array<{ id, source_name }>} articles
 * @returns {[Object, Object] | null}
 */
export function pickDefaultPair(articles) {
  if (articles.length < 2) return null
  const first = articles[0]
  const other = articles.find((article) => article.source_name !== first.source_name)
  return [first, other || articles[1]]
}

/**
 * The framing types found in one article: the headline's and the signals'.
 *
 * @param {Object | null} tone - from toToneFraming, or null
 * @returns {string[]} frame types, each once
 */
export function framesOf(tone) {
  if (!tone) return []
  const frames = [...tone.headline_framing.frames, ...tone.signals.map((signal) => signal.frame_type)]
  return [...new Set(frames.filter(Boolean))]
}

/**
 * Which articles use each framing type.
 *
 * @param {Array<{ article, analyses }>} items
 * @returns {Array<{ frame: string, articles: Array }>} most used first
 */
export function groupFrames(items) {
  const byFrame = new Map()
  for (const { article, analyses } of items) {
    for (const frame of framesOf(analyses?.tone)) {
      if (!byFrame.has(frame)) byFrame.set(frame, [])
      byFrame.get(frame).push(article)
    }
  }
  return [...byFrame.entries()]
    .map(([frame, articles]) => ({ frame, articles }))
    .sort((x, y) => y.articles.length - x.articles.length)
}

/**
 * Which articles name each item of a list (entities or topics).
 * Only articles whose insights loaded are counted.
 *
 * @param {Array<{ article, analyses }>} items
 * @param {'entities' | 'topics'} listName - which insights list to use
 * @returns {{ analysedCount: number,
 *   inAll: Array<{ name, type, articles }>,
 *   inSome: Array<{ name, type, articles }> }}
 *   inAll: named by every analysed article (needs 2 or more)
 *   inSome: named by some, but not all (most named first)
 */
export function nameCoverage(items, listName) {
  const analysed = items.filter(({ analyses }) => analyses?.insights)
  const byName = new Map()
  for (const { article, analyses } of analysed) {
    const seen = new Set()
    for (const entry of analyses.insights[listName]) {
      const key = nameKey(entry.name)
      if (seen.has(key)) continue
      seen.add(key)
      if (!byName.has(key)) byName.set(key, { name: entry.name, type: entry.type || null, articles: [] })
      byName.get(key).articles.push(article)
    }
  }
  const all = [...byName.values()].sort((x, y) => y.articles.length - x.articles.length)
  const everyArticle = (row) => analysed.length >= 2 && row.articles.length === analysed.length
  return {
    analysedCount: analysed.length,
    inAll: all.filter(everyArticle),
    inSome: all.filter((row) => !everyArticle(row)),
  }
}

// People, organizations, places...
export function entityCoverage(items) {
  return nameCoverage(items, 'entities')
}

/**
 * Publishers of a story and how many of its articles each wrote.
 *
 * @param {Array<{ source_name }>} articles
 * @returns {Array<{ name: string, count: number }>} most articles first
 */
export function publishersOf(articles) {
  const counts = new Map()
  for (const article of articles) {
    const name = article.source_name || 'Unknown publisher'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => y.count - x.count)
}

/**
 * The earliest and latest publication dates of some articles.
 *
 * @param {Array<{ published_at }>} articles
 * @returns {{ first: string, last: string } | null} null when no article has a date
 */
export function dateRangeOf(articles) {
  const dates = articles
    .map((article) => article.published_at)
    .filter(Boolean)
    .sort((x, y) => new Date(x) - new Date(y))
  return dates.length > 0 ? { first: dates[0], last: dates[dates.length - 1] } : null
}
