import React, { useEffect, useState } from 'react'
import SimilarArticleCard from './SimilarArticleCard'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import { fetchSimilarArticles } from '../api/newsApi'

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

  const [prevArticleId, setPrevArticleId] = useState(articleId)
  if (articleId !== prevArticleId) {
    setPrevArticleId(articleId)
    setIsLoading(Boolean(articleId))
    setError(null)
    setSimilarityData(null)
  }

  useEffect(() => {
    let isCurrentRequest = true

    if (!articleId) return

    fetchSimilarArticles(articleId, { limit: 5 })
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
          Discovered via vector embeddings nearest-neighbor search. Semantic similarity reflects shared terminology and theme; it does not confirm identical event identity.
        </p>

        <div className="similar-articles-grid">
          {matches.map((match) => (
            <SimilarArticleCard
              key={match.article_id}
              article={match}
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
