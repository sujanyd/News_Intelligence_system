import React, { useEffect, useState } from 'react'
import ClassificationBadge from './ClassificationBadge'
import { fetchMatches } from '../api/newsApi'

const LABELS = ['SAME', 'RELATED', 'DIFFERENT']

/**
 * ArticleMatchSummary Component
 *
 * A small cell for the article table: how many of this article's stored
 * pairs the backend classified as SAME, RELATED or DIFFERENT.
 * Data: GET /articles/{id}/matches (only stored matches; nothing is run).
 *
 * @param {Object} props
 * @param {number} props.articleId
 */
export function ArticleMatchSummary({ articleId }) {
  const [counts, setCounts] = useState(null)
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    let isCurrentRequest = true
    fetchMatches({ articleId })
      .then((matchList) => {
        if (!isCurrentRequest) return
        const newCounts = { SAME: 0, RELATED: 0, DIFFERENT: 0 }
        for (const match of matchList) newCounts[match.match_label] += 1
        setCounts(newCounts)
      })
      .catch(() => {
        if (isCurrentRequest) setHasFailed(true)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [articleId])

  if (hasFailed) return <span className="ai-chip-extra">Not loaded</span>
  if (!counts) return <span className="ai-chip-extra">Loading...</span>

  const found = LABELS.filter((label) => counts[label] > 0)
  if (found.length === 0) return <span className="ai-chip-extra">Not classified</span>

  return (
    <span className="cmp-badges" data-testid={`match-summary-${articleId}`}>
      {found.map((label) => (
        <span key={label}>
          <ClassificationBadge label={label} size="sm" /> ×{counts[label]}
        </span>
      ))}
    </span>
  )
}

export default ArticleMatchSummary
