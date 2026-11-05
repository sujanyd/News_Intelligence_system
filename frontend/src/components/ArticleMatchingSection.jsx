import React, { useState, useEffect, useCallback } from 'react'
import MatchedPairCard from './MatchedPairCard'
import SideBySideComparison from './SideBySideComparison'
import EmptyState from './EmptyState'
import AlertMessage from './AlertMessage'
import {
  fetchMatches,
  runArticleMatching,
  submitMatchReview,
  MATCH_REVIEW_AVAILABLE,
} from '../api/newsApi'

/**
 * ArticleMatchingSection Component
 *
 * Manages the matching results section for ONE article:
 *   - Fetches its stored matches: GET /articles/{id}/matches
 *     (the backend has no route that lists every match).
 *   - "Run matching" classifies its nearest articles: POST /articles/{id}/match
 *   - Displays the pairs with their SAME / RELATED / DIFFERENT labels.
 *   - Category filter tabs: All, SAME, RELATED, DIFFERENT.
 *   - Search input to filter pairs by article title or source.
 *   - Loading, Empty, and Error states with retry capability.
 *   - Side-by-side comparison modal/view when a pair is selected.
 *
 * @param {Object} props
 * @param {number|string} [props.articleId] - The article whose matches to show.
 *   Without it, the section asks the user to choose an article.
 * @param {string} [props.title='Article Matching & Classification Review']
 * @param {boolean} [props.isReviewSupported=MATCH_REVIEW_AVAILABLE]
 */
export function ArticleMatchingSection({
  articleId,
  title = 'Article Matching & Classification Review',
  isReviewSupported = MATCH_REVIEW_AVAILABLE,
}) {
  const hasArticle = articleId !== undefined && articleId !== null && articleId !== ''
  const [matches, setMatches] = useState([])
  const [isLoading, setIsLoading] = useState(hasArticle)
  const [error, setError] = useState(null)

  // "Run matching" status
  const [isRunning, setIsRunning] = useState(false)
  const [runSummary, setRunSummary] = useState(null)
  const [runError, setRunError] = useState('')
  const [includeLowSimilarity, setIncludeLowSimilarity] = useState(false)
  const [filterLabel, setFilterLabel] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCancelled = false
    if (!hasArticle) return

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
  }, [articleId, hasArticle, reloadKey])

  async function handleRunMatching() {
    if (isRunning) return // a run is already going
    setIsRunning(true)
    setRunSummary(null)
    setRunError('')
    try {
      // 0 = classify the nearest articles even when their vector similarity is low
      const summary = await runArticleMatching(articleId, {
        scoreThreshold: includeLowSimilarity ? 0 : undefined,
      })
      setRunSummary(summary)
      handleRetry() // load the stored matches again
    } catch (err) {
      setRunError(err.message || 'Matching failed.')
    } finally {
      setIsRunning(false)
    }
  }

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

  if (!hasArticle) {
    return (
      <section className="article-matching-section" data-testid="article-matching-section">
        <h3 className="ams-title">{title}</h3>
        <EmptyState
          title="Choose an article"
          description="Matches are stored per article. Pick an article to see its SAME, RELATED and DIFFERENT pairs."
        />
      </section>
    )
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

      {/* Run matching for this article */}
      <div className="ams-run-bar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRunMatching}
          disabled={isRunning}
          aria-busy={isRunning}
        >
          {isRunning ? (
            <span className="loading-spinner-wrap">
              <span className="spinner" aria-hidden="true" /> Classifying...
            </span>
          ) : (
            'Run matching'
          )}
        </button>
        <label className="ams-run-option">
          <input
            type="checkbox"
            checked={includeLowSimilarity}
            onChange={(event) => setIncludeLowSimilarity(event.target.checked)}
            disabled={isRunning}
          />{' '}
          Include low-similarity candidates
        </label>
      </div>

      {runError && (
        <AlertMessage type="error" title="Matching failed." message={runError} />
      )}

      {runSummary && runSummary.candidates_retrieved === 0 && (
        <AlertMessage
          type="info"
          message={`No candidate articles were found above the backend's similarity cutoff${
            includeLowSimilarity ? '' : ' (0.2). Tick "Include low-similarity candidates" to classify the nearest articles anyway'
          }.`}
        />
      )}

      {runSummary && runSummary.candidates_retrieved > 0 && (
        <AlertMessage
          type="success"
          message={`Classified ${runSummary.candidates_retrieved} candidate articles: ${runSummary.matches_created} new, ${runSummary.matches_updated} updated, ${runSummary.matches_skipped} already stored.`}
        />
      )}

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
                : 'This article has no stored matches yet. Click "Run matching" to classify its nearest articles.'
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
