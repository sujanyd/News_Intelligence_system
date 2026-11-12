/**
 * Each publisher once, with how many of the articles it wrote, most first.
 *
 * @param {Array<{ source_name: string | null }>} articles
 * @returns {Array<{ name: string, count: number }>}
 */
export function countPublishers(articles) {
  const counts = new Map()
  for (const article of articles) {
    const name = article.source_name || 'Unknown publisher'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
