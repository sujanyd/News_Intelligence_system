import React, { useState, useEffect, useCallback } from 'react'
import MatchedPairCard from './MatchedPairCard'
import SideBySideComparison from './SideBySideComparison'
import EmptyState from './EmptyState'
import AlertMessage from './AlertMessage'
import { fetchMatches, submitMatchReview, MATCH_REVIEW_AVAILABLE } from '../api/newsApi'

/**
 * ArticleMatchingSection Component
 *
 * Manages the matching results section:
 *   - Fetches and displays pairwise article matches with classification labels.
 *   - Category filter tabs: All, SAME, RELATED, DIFFERENT.
 *   - Search input to filter pairs by article title or source.
 *   - Loading, Empty, and Error states with retry capability.
 *   - Side-by-side comparison modal/view when a pair is selected.
 *
 * @param {Object} props
 * @param {number|string} [props.articleId] - Optional query article ID filter
 * @param {string} [props.title='Article Matching & Classification Review']
 * @param {boolean} [props.isReviewSupported=MATCH_REVIEW_AVAILABLE]
 */
export function ArticleMatchingSection({
  articleId,
  title = 'Article Matching & Classification Review',
  isReviewSupported = MATCH_REVIEW_AVAILABLE,
}) {
  const [matches, setMatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterLabel, setFilterLabel] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCancelled = false

    fetchMatches({ articleId })
      .then((data) => {
        if (!isCancelled) setMatches(data)
      })
      .catch((err) => {
        if (!isCancelled) setError(err.message || 'Could not load article matches from backend.')
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [articleId, reloadKey])

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }, [])

  // Filter matches by classification label and title search
  const filteredMatches = matches.filter((item) => {
    if (filterLabel !== 'ALL' && item.match_label?.toUpperCase() !== filterLabel) {
      return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleA = item.article_a?.title?.toLowerCase() || ''
      const titleB = item.article_b?.title?.toLowerCase() || ''
      const srcA = item.article_a?.source_name?.toLowerCase() || ''
      const srcB = item.article_b?.source_name?.toLowerCase() || ''
      if (
        !titleA.includes(q) &&
        !titleB.includes(q) &&
        !srcA.includes(q) &&
        !srcB.includes(q)
      ) {
        return false
      }
    }

    return true
  })

  // Count totals for each classification
  const countSame = matches.filter((m) => m.match_label === 'SAME').length
  const countRelated = matches.filter((m) => m.match_label === 'RELATED').length
  const countDifferent = matches.filter((m) => m.match_label === 'DIFFERENT').length

  async function handleReviewSubmit(matchId, reviewData) {
    const updated = await submitMatchReview(matchId, reviewData)
    // Update local state
    setMatches((prev) =>
      prev.map((m) => (String(m.id) === String(matchId) ? { ...m, ...updated } : m))
    )
    if (selectedMatch && String(selectedMatch.id) === String(matchId)) {
      setSelectedMatch((prev) => ({ ...prev, ...updated }))
    }
    return updated
  }

  // If a match is selected for side-by-side comparison, render comparison view
  if (selectedMatch) {
    return (
      <SideBySideComparison
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        isReviewSupported={isReviewSupported}
        onReviewSubmit={handleReviewSubmit}
      />
    )
  }

  return (
    <section className="article-matching-section" data-testid="article-matching-section">
      <div className="ams-header">
        <div className="ams-title-group">
          <h3 className="ams-title">{title}</h3>
          <p className="ams-subtitle">
            Inspect article pairs clustered by the embedding and matching pipeline with <strong>SAME</strong>,{' '}
            <strong>RELATED</strong>, and <strong>DIFFERENT</strong> classification labels.
          </p>
        </div>

        {/* Filter Badges & Search */}
        <div className="ams-controls-bar">
          <div className="ams-filter-tabs" role="tablist" aria-label="Filter matches by classification">
            <button
              type="button"
              className={`ams-tab ${filterLabel === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterLabel('ALL')}
              aria-selected={filterLabel === 'ALL'}
              role="tab"
            >
              All ({matches.length})
            </button>
            <button
              type="button"
              className={`ams-tab ams-tab-same ${filterLabel === 'SAME' ? 'active' : ''}`}
              onClick={() => setFilterLabel('SAME')}
              aria-selected={filterLabel === 'SAME'}
              role="tab"
            >
              <span className="ams-tab-dot dot-same" aria-hidden="true" />
              SAME ({countSame})
            </button>
            <button
              type="button"
              className={`ams-tab ams-tab-related ${filterLabel === 'RELATED' ? 'active' : ''}`}
              onClick={() => setFilterLabel('RELATED')}
              aria-selected={filterLabel === 'RELATED'}
              role="tab"
            >
              <span className="ams-tab-dot dot-related" aria-hidden="true" />
              RELATED ({countRelated})
            </button>
            <button
              type="button"
              className={`ams-tab ams-tab-different ${filterLabel === 'DIFFERENT' ? 'active' : ''}`}
              onClick={() => setFilterLabel('DIFFERENT')}
              aria-selected={filterLabel === 'DIFFERENT'}
              role="tab"
            >
              <span className="ams-tab-dot dot-different" aria-hidden="true" />
              DIFFERENT ({countDifferent})
            </button>
          </div>

          <div className="ams-search-box">
            <input
              type="search"
              className="form-control form-control-sm ams-search-input"
              placeholder="Search headline or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter article pairs by headline or source"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="ams-loading-box" data-testid="ams-loading">
          <div className="spinner" aria-hidden="true" />
          <span>Loading matched article pairs and classifications...</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="ams-error-box" data-testid="ams-error">
          <AlertMessage
            type="error"
            title="Could not load matched article pairs."
            message={error}
            onRetry={handleRetry}
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredMatches.length === 0 && (
        <div className="ams-empty-box" data-testid="ams-empty">
          <EmptyState
            title="No matched article pairs found"
            description={
              searchQuery || filterLabel !== 'ALL'
                ? 'No pairs match the selected filter criteria. Try resetting filters or search query.'
                : 'No article pairs have been evaluated for matching and classification yet. Ingest articles and generate embeddings to trigger pairwise matching.'
            }
          />
        </div>
      )}

      {/* Matched Pairs List */}
      {!isLoading && !error && filteredMatches.length > 0 && (
        <div className="ams-pairs-grid" data-testid="ams-pairs-grid">
          {filteredMatches.map((match) => (
            <MatchedPairCard
              key={match.id}
              match={match}
              onCompare={(selected) => setSelectedMatch(selected)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default ArticleMatchingSection
