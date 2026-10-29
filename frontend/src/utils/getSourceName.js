/**
 * Finds the name to show for an article's source.
 *
 * 1. The backend's source_name on the article
 * 2. Otherwise the name from the sources list
 * 3. Otherwise "Source #id", or "Unknown source"
 *
 * @param {Object} article
 * @param {Array} sources - list from fetchSources() (can be empty)
 */
export function getSourceName(article, sources) {
  if (article.source_name) return article.source_name
  const source = sources.find((item) => String(item.id) === String(article.source_id))
  if (source) return source.name
  if (article.source_id !== null) return `Source #${article.source_id}`
  return 'Unknown source'
}
