import React, { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { fetchArticleInsights, INSIGHTS_AVAILABLE, rerunArticleInsights } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { formatEntityType, groupEntities } from '../utils/groupEntities'

// How the fact's verification_status is shown
function VerificationBadge({ status }) {
  if (status === 'verified') return <StatusBadge variant="success">Verified</StatusBadge>
  if (status === 'disputed') return <StatusBadge variant="warning">Disputed</StatusBadge>
  if (status === 'unverified' || status === null) {
    return <StatusBadge variant="neutral">Not checked</StatusBadge>
  }
  return <StatusBadge variant="neutral">{formatEntityType(status)}</StatusBadge>
}

// "Elena Rostova, Summit Co-Chair", or a note when the backend found no speaker
function describeSpeaker(quote) {
  if (quote.speaker_name && quote.speaker_title) {
    return `${quote.speaker_name}, ${quote.speaker_title}`
  }
  return quote.speaker_name || quote.speaker_title || 'Speaker not identified'
}

/**
 * ArticleInsightsSection Component
 *
 * Shows what the backend extracted from one article:
 *   - Topics   (most relevant first)
 *   - Entities (grouped into people, organizations, locations and other)
 *   - Facts    (statements the article makes, with their check status)
 *   - Quotes   (with the speaker, when the backend found one)
 *
 * Data: GET /articles/{id}/extraction. The first time, the backend analyses
 * the article before it answers. "Analyse again" calls
 * POST /articles/{id}/extract to replace the result with a fresh one.
 *
 * In mock mode nothing is loaded: there are no sample insights on purpose.
 *
 * @param {Object} props
 * @param {number | string} props.articleId - Which article
 * @param {string | null} [props.contentAvailability] - 'full_text', 'summary_only' or 'headline_only'
 */
export function ArticleInsightsSection({ articleId, contentAvailability }) {
  const [insights, setInsights] = useState(null)
  const [isLoading, setIsLoading] = useState(INSIGHTS_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunError, setRerunError] = useState('')

  useEffect(() => {
    if (!INSIGHTS_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchArticleInsights(articleId)
      .then((result) => {
        if (isCurrentRequest) setInsights(result)
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
  }, [articleId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  async function handleRerun() {
    if (isRerunning) return // already running
    setIsRerunning(true)
    setRerunError('')
    try {
      setInsights(await rerunArticleInsights(articleId))
    } catch (error) {
      setRerunError(error.message)
    } finally {
      setIsRerunning(false)
    }
  }

  function renderTopics() {
    if (insights.topics.length === 0) {
      return <p className="ai-none">No topics found.</p>
    }
    const sorted = [...insights.topics].sort(
      (a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1)
    )
    return (
      <ul className="ai-chip-list" aria-label="Topics">
        {sorted.map((topic) => (
          <li key={topic.id} className="ai-chip" title={topic.evidence_text || undefined}>
            {topic.name}
          </li>
        ))}
      </ul>
    )
  }

  function renderEntities() {
    if (insights.entities.length === 0) {
      return <p className="ai-none">No people, organizations or places found.</p>
    }
    return (
      <div className="ai-entity-groups">
        {groupEntities(insights.entities).map((group) => (
          <div key={group.type} className="ai-entity-group">
            <p className="ai-entity-group-title">{group.label}</p>
            <ul className="ai-chip-list" aria-label={group.label}>
              {group.entities.map((entity) => (
                <li key={entity.id} className="ai-chip">
                  {entity.name}
                  {group.type === 'OTHER' && (
                    <span className="ai-chip-extra"> · {formatEntityType(entity.type)}</span>
                  )}
                  {entity.mention_count !== null && entity.mention_count > 1 && (
                    <span className="ai-chip-extra"> · {entity.mention_count} mentions</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  function renderFacts() {
    if (insights.facts.length === 0) {
      return <p className="ai-none">No factual statements found.</p>
    }
    return (
      <ul className="ai-fact-list" aria-label="Facts">
        {insights.facts.map((fact) => (
          <li key={fact.id} className="ai-fact">
            <span>{fact.statement}</span>
            <VerificationBadge status={fact.verification_status} />
          </li>
        ))}
      </ul>
    )
  }

  function renderQuotes() {
    if (insights.quotes.length === 0) {
      return <p className="ai-none">No quotes found.</p>
    }
    return (
      <div className="ai-quote-list">
        {insights.quotes.map((quote) => (
          <figure key={quote.id} className="ai-quote">
            <blockquote>“{quote.text}”</blockquote>
            <figcaption
              className={quote.speaker_name || quote.speaker_title ? '' : 'ai-speaker-missing'}
            >
              — {describeSpeaker(quote)}
            </figcaption>
          </figure>
        ))}
      </div>
    )
  }

  function renderBody() {
    if (!INSIGHTS_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Insights need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There are no sample insights, so nothing made up is ever shown."
        />
      )
    }
    if (isLoading) {
      return <LoadingState message="Loading insights... The first time, the backend analyses the article." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the insights."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }

    const isEmpty =
      insights.topics.length === 0 &&
      insights.entities.length === 0 &&
      insights.facts.length === 0 &&
      insights.quotes.length === 0

    return (
      <>
        {insights.status && insights.status !== 'completed' && (
          <AlertMessage
            type="warning"
            title="The analysis is not complete."
            message={`The backend reports the status "${insights.status}". Some insights may be missing.`}
          />
        )}

        {isEmpty ? (
          <EmptyState
            title="No insights found"
            description={
              contentAvailability === 'headline_only'
                ? 'Only the headline was collected, so there was very little text to analyse.'
                : 'The backend analysed this article but found no topics, entities, facts or quotes.'
            }
          />
        ) : (
          <div className="ai-grid">
            <div className="ai-block">
              <h5 className="ai-block-title">Topics</h5>
              {renderTopics()}
            </div>
            <div className="ai-block">
              <h5 className="ai-block-title">Entities</h5>
              {renderEntities()}
            </div>
            <div className="ai-block">
              <h5 className="ai-block-title">Facts</h5>
              {renderFacts()}
            </div>
            <div className="ai-block">
              <h5 className="ai-block-title">Quotes</h5>
              {renderQuotes()}
            </div>
          </div>
        )}

        <div className="ai-footer">
          <p className="ad-section-note">
            Found automatically by the backend
            {insights.pipeline_version ? ` (${insights.pipeline_version})` : ''}
            {insights.created_at ? ` on ${formatDate(insights.created_at)}` : ''}. Automatic
            extraction can make mistakes. Facts are what the article says; &quot;Not
            checked&quot; means nobody has verified them.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRerun}
            disabled={isRerunning}
            aria-busy={isRerunning}
          >
            {isRerunning ? 'Analysing...' : 'Analyse again'}
          </button>
        </div>
        {rerunError && (
          <AlertMessage type="error" title="Could not analyse the article again." message={rerunError} />
        )}
      </>
    )
  }

  return (
    <section
      className="ad-section"
      aria-labelledby="ad-section-insights"
      data-testid="insights-section"
    >
      <h4 className="ad-section-title" id="ad-section-insights">
        Article Insights
      </h4>
      {renderBody()}
    </section>
  )
}

export default ArticleInsightsSection
