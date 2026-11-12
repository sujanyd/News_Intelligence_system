import React, { useEffect, useState } from 'react'
import SimilarArticleCard from './SimilarArticleCard'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import { fetchMatches, fetchSimilarArticles, runArticleMatching } from '../api/newsApi'

// How many similar articles to show (and to classify)
const SIMILAR_LIMIT = 5

// Turns the stored matches of an article into { otherArticleId: 'SAME' | 'RELATED' | 'DIFFERENT' }
function labelsByOtherArticle(matchList, articleId) {
  const labels = {}
  for (const match of matchList) {
    const otherId =
      String(match.article_id_1) === String(articleId) ? match.article_id_2 : match.article_id_1
    labels[String(otherId)] = match.match_label
  }
  return labels
}

// { [otherArticleId]: confidence 0..1 } from the stored matches (only when the backend sent one)
function confidenceByOtherArticle(matchList, articleId) {
  const confidences = {}
  for (const match of matchList) {
    if (match.confidence_score === null) continue
    const otherId =
      String(match.article_id_1) === String(articleId) ? match.article_id_2 : match.article_id_1
    confidences[String(otherId)] = match.confidence_score
  }
  return confidences
}

/**
 * Checks whether an error is due to missing embeddings (HTTP 404 from backend)
 */
function isMissingEmbeddingsError(error) {
  if (!error) return false
  if (error.status === 404) return true
  const msg = error.message ? error.message.toLowerCase() : ''
  return msg.includes('embedding') || msg.includes('generate embeddings first')
}

/**
 * Checks whether an error is due to vector database unavailability (HTTP 503 from backend)
 */
function isVectorDbUnavailableError(error) {
  if (!error) return false
  if (error.status === 503) return true
  const msg = error.message ? error.message.toLowerCase() : ''
  return msg.includes('qdrant') || msg.includes('vector database') || msg.includes('503')
}

/**
 * SimilarArticlesSection Component
 *
 * Section inside ArticleDetails showing semantically similar articles
 * found through vector similarity search.
 *
 * Handles:
 *   - Loading state
 *   - Successful matches with formatted similarity scores
 *   - No similar articles found (empty state)
 *   - API errors (missing embeddings, Qdrant offline, network errors) with retry
 *   - Navigation callback to open any matched article
 *   - The SAME / RELATED / DIFFERENT label of each similar article, from the
 *     stored matches (GET /articles/{id}/matches). "Classify these articles"
 *     runs POST /articles/{id}/match for exactly the articles shown.
 *
 * @param {Object} props
 * @param {number | string} props.articleId - Currently inspected article ID
 * @param {(articleId: number) => void} [props.onSelectArticle] - Navigation handler
 */
export function SimilarArticlesSection({ articleId, onSelectArticle }) {
  const [similarityData, setSimilarityData] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(articleId))
  const [error, setError] = useState(null)
  const [reloadCount, setReloadCount] = useState(0)

  // Stored classification labels for the similar articles
  const [matchLabels, setMatchLabels] = useState({})
  const [matchConfidences, setMatchConfidences] = useState({})
  const [matchesError, setMatchesError] = useState('')
  const [matchesReloadCount, setMatchesReloadCount] = useState(0)
  const [isClassifying, setIsClassifying] = useState(false)
  const [classifyError, setClassifyError] = useState('')

  const [prevArticleId, setPrevArticleId] = useState(articleId)
  if (articleId !== prevArticleId) {
    setPrevArticleId(articleId)
    setIsLoading(Boolean(articleId))
    setError(null)
    setSimilarityData(null)
    setMatchLabels({})
    setMatchConfidences({})
    setMatchesError('')
    setClassifyError('')
  }

  // Load the stored SAME / RELATED / DIFFERENT labels (a failure only hides the badges)
  useEffect(() => {
    let isCurrentRequest = true
    if (!articleId) return

    fetchMatches({ articleId })
      .then((matchList) => {
        if (isCurrentRequest) {
          setMatchLabels(labelsByOtherArticle(matchList, articleId))
          setMatchConfidences(confidenceByOtherArticle(matchList, articleId))
          setMatchesError('')
        }
      })
      .catch((err) => {
        if (isCurrentRequest) setMatchesError(err.message || 'Could not load classifications.')
      })

    return () => {
      isCurrentRequest = false
    }
  }, [articleId, matchesReloadCount])

  async function handleClassify() {
    if (isClassifying) return // already running
    setIsClassifying(true)
    setClassifyError('')
    try {
      // Same search as the list above (headline, top 5, no cutoff), so exactly
      // the shown articles are classified
      await runArticleMatching(articleId, { candidateLimit: SIMILAR_LIMIT, scoreThreshold: -1 })
      setMatchesReloadCount((count) => count + 1)
    } catch (err) {
      setClassifyError(err.message || 'Classification failed.')
    } finally {
      setIsClassifying(false)
    }
  }

  useEffect(() => {
    let isCurrentRequest = true

    if (!articleId) return

    fetchSimilarArticles(articleId, { limit: SIMILAR_LIMIT })
      .then((data) => {
        if (isCurrentRequest) {
          setSimilarityData(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (isCurrentRequest) {
          setError(err)
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrentRequest = false
    }
  }, [articleId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setError(null)
    setReloadCount((c) => c + 1)
  }

  function renderContent() {
    if (isLoading) {
      return <LoadingState message="Searching for semantically similar articles…" />
    }

    if (error) {
      if (isMissingEmbeddingsError(error)) {
        return (
          <div className="similar-articles-notice-box" data-testid="similar-notice-no-embeddings">
            <div className="san-header">
              <StatusBadge variant="pending">Embeddings Required</StatusBadge>
            </div>
            <p className="san-text">
              Vector embeddings have not been generated for this article yet. Semantic similarity search requires vector embeddings to compare text representations.
            </p>
          </div>
        )
      }

      if (isVectorDbUnavailableError(error)) {
        return (
          <div className="similar-articles-notice-box" data-testid="similar-notice-vectordb-unavailable">
            <div className="san-header">
              <StatusBadge variant="unavailable">Vector Service Unavailable</StatusBadge>
            </div>
            <p className="san-text">
              The vector similarity search service is currently offline or unreachable. The rest of this article remains fully accessible.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRetry}
              style={{ marginTop: '0.75rem' }}
            >
              Retry Search
            </button>
          </div>
        )
      }

      return (
        <AlertMessage
          type="error"
          title="Could not load similar articles."
          message={error.message || 'An error occurred during similarity search.'}
          onRetry={handleRetry}
        />
      )
    }

    const matches = similarityData && Array.isArray(similarityData.matches)
      ? similarityData.matches
      : []

    if (matches.length === 0) {
      return (
        <EmptyState
          title="No similar articles found"
          description="No other collected articles meet the semantic similarity criteria for this article."
        />
      )
    }

    return (
      <div className="similar-articles-list" data-testid="similar-articles-list">
        <p className="similar-articles-disclaimer">
          Similarity measures shared wording and theme, not whether it is the same event; the SAME / RELATED / DIFFERENT label does that.
        </p>

        <div className="similar-classify-bar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClassify}
            disabled={isClassifying}
            aria-busy={isClassifying}
          >
            {isClassifying ? (
              <span className="loading-spinner-wrap">
                <span className="spinner" aria-hidden="true" /> Classifying...
              </span>
            ) : (
              'Classify these articles'
            )}
          </button>
          {matchesError && (
            <span className="form-hint">Classifications unavailable: {matchesError}</span>
          )}
        </div>

        {classifyError && (
          <AlertMessage type="error" title="Classification failed." message={classifyError} />
        )}

        <div className="similar-articles-grid">
          {matches.map((match) => (
            <SimilarArticleCard
              key={match.article_id}
              article={match}
              matchLabel={matchLabels[String(match.article_id)] || null}
              matchConfidence={matchConfidences[String(match.article_id)] ?? null}
              showMatchLabel={!matchesError}
              onSelect={onSelectArticle}
            />
          ))}
        </div>
      </div>
    )
  }

  const matchCount = similarityData && Array.isArray(similarityData.matches)
    ? similarityData.matches.length
    : null

  return (
    <section
      className="ad-section similar-articles-section"
      aria-labelledby="ad-section-similar"
      data-testid="similar-articles-section"
    >
      <div className="ad-section-header-row">
        <h4 className="ad-section-title" id="ad-section-similar">
          Similar Articles
          {matchCount !== null && (
            <span className="similar-count-badge" title={`${matchCount} similar articles found`}>
              {matchCount}
            </span>
          )}
        </h4>
      </div>

      {renderContent()}
    </section>
  )
}

export default SimilarArticlesSection
