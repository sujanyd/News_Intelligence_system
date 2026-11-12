import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import StatusBadge from './StatusBadge'
import {
  AI_DETECTION_AVAILABLE,
  AI_FLAG_THRESHOLD,
  fetchArticle,
  fetchFlaggedAiDetections,
} from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { formatPercent } from '../utils/toneLabels'

// How many flagged articles the dashboard lists
const FLAGGED_LIMIT = 10

/**
 * FlaggedArticlesPanel Component
 *
 * Articles the backend's AI detector flagged for a human to check
 * (GET /articles/ai-detection/flagged). The flagged list only has article
 * ids, so each article's title and publisher come from GET /articles/{id}
 * (one request per listed article, at most FLAGGED_LIMIT).
 *
 * A flag means "a person should look at this", never "this is AI-generated".
 *
 * @param {Object} props
 * @param {(articleId: number, sourceName?: string) => void} props.onOpenArticle
 */
export function FlaggedArticlesPanel({ onOpenArticle }) {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(AI_DETECTION_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!AI_DETECTION_AVAILABLE) return undefined
    let isCurrentRequest = true
    async function load() {
      const flagged = await fetchFlaggedAiDetections({ limit: FLAGGED_LIMIT })
      // One article may have been checked more than once: list it once
      const unique = flagged.filter(
        (item, index) => flagged.findIndex((other) => other.article_id === item.article_id) === index
      )
      const articles = await Promise.allSettled(unique.map((item) => fetchArticle(item.article_id)))
      return unique.map((detection, index) => ({
        id: detection.article_id,
        detection,
        // A missing article is shown by its id instead of failing the whole list
        article: articles[index].status === 'fulfilled' ? articles[index].value : null,
      }))
    }
    load()
      .then((result) => {
        if (isCurrentRequest) setRows(result)
      })
      .catch((error) => {
        if (isCurrentRequest) setErrorMessage(error.message)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  const columns = [
    {
      key: 'title',
      label: 'Article',
      render: ({ id, article }) => <strong>{article ? article.title : `Article #${id} (details not loaded)`}</strong>,
    },
    { key: 'source', label: 'Publisher', render: ({ article }) => article?.source_name || 'Unknown' },
    {
      key: 'estimate',
      label: 'AI-likelihood estimate',
      render: ({ detection }) => (
        <StatusBadge variant="warning">{formatPercent(detection.ai_likelihood)} · needs review</StatusBadge>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      render: ({ detection }) => formatPercent(detection.confidence),
    },
    { key: 'checked', label: 'Checked on', render: ({ detection }) => formatDate(detection.created_at) },
    {
      key: 'open',
      label: 'Details',
      render: ({ id, article }) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpenArticle(id, article?.source_name || undefined)}
          aria-label={`View details for ${article ? article.title : `article ${id}`}`}
        >
          View
        </button>
      ),
    },
  ]

  function renderBody() {
    if (!AI_DETECTION_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Flagged articles need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading flagged articles..." />
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the flagged articles."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          title="No article is flagged for review"
          description={`No checked article has an estimate of ${Math.round(
            AI_FLAG_THRESHOLD * 100
          )}% or more. Only articles whose details were opened have been checked so far.`}
        />
      )
    }
    return (
      <>
        <DataTable columns={columns} rows={rows} caption="Articles flagged for editorial review" />
        {rows.length >= FLAGGED_LIMIT && (
          <p className="ingestion-note">Showing the {FLAGGED_LIMIT} highest estimates.</p>
        )}
      </>
    )
  }

  return (
    <Card
      title="Flagged for Editorial Review"
      subtitle={`AI-likelihood estimate of ${Math.round(AI_FLAG_THRESHOLD * 100)}% or more`}
      badge={
        AI_DETECTION_AVAILABLE && !isLoading && !errorMessage ? (
          <StatusBadge variant={rows.length > 0 ? 'warning' : 'neutral'}>
            {rows.length} flagged
          </StatusBadge>
        ) : undefined
      }
    >
      <div data-testid="flagged-articles-panel">
        {renderBody()}
        <p className="ad-section-note">
          A flag means a person should check the article; it is <strong>not proof</strong> that it
          was written by AI.
        </p>
      </div>
    </Card>
  )
}

export default FlaggedArticlesPanel
