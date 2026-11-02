/**
 * Formats a decimal cosine similarity score (e.g. 0.884) as a clean percentage (e.g. "88%").
 *
 * @param {number} score - Cosine similarity value between 0.0 and 1.0
 * @returns {string | null} Formatted percentage or null if score is invalid
 */
export function formatSimilarityPercentage(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  const clamped = Math.max(0, Math.min(1, score))
  return `${Math.round(clamped * 100)}%`
}
