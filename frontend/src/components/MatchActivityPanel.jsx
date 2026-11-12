import React, { useEffect, useState } from 'react'
import Card from './Card'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import ClassificationBadge from './ClassificationBadge'
import { fetchRecentMatchActivity } from '../api/newsApi'
import { formatSimilarityPercentage } from '../utils/formatSimilarity'
import { formatDate } from '../utils/formatDate'

// How many of the newest articles are checked for stored matches
const ARTICLES_TO_CHECK = 10
// How many of the newest matches are listed under the bar
const MATCHES_TO_LIST = 5

const LABELS = ['SAME', 'RELATED', 'DIFFERENT']

/**
 * One bar split into SAME / RELATED / DIFFERENT, with the numbers
 * written next to it (the colours are never the only way to read it).
 */
function DistributionBar({ counts, total }) {
  return (
    <div className="match-dist">
      <div
        className="match-dist-bar"
        role="img"
        aria-label={LABELS.map((label) => `${label}: ${counts[label]}`).join(', ')}
      >
        {LABELS.map((label) =>
          counts[label] > 0 ? (
            <span
              key={label}
              className={`match-dist-part match-dist-${label.toLowerCase()}`}
              style={{ flexGrow: counts[label] }}
            />
          ) : null
        )}
      </div>
      <ul className="match-dist-legend" aria-label="Classification counts">
        {LABELS.map((label) => (
          <li key={label}>
            <ClassificationBadge label={label} size="sm" />
            <strong>{counts[label]}</strong>
            <span className="ai-chip-extra">
              {total > 0 ? `${Math.round((counts[label] / total) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * MatchActivityPanel Component
 *
 * Similar-article activity on the Dashboard: how the stored article pairs
 * of the newest articles were classified (SAME / RELATED / DIFFERENT), and
 * the newest of those pairs.
 *
 * The backend has no route that lists every match, so this only looks at
 * the matches of the ARTICLES_TO_CHECK newest articles (see
 * fetchRecentMatchActivity). The card says so.
 *
 * @param {Object} props
 * @param {(articleId: number, sourceName?: string) => void} props.onOpenArticle
 */
export function MatchActivityPanel({ onOpenArticle }) {
  const [activity, setActivity] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    fetchRecentMatchActivity({ articleLimit: ARTICLES_TO_CHECK })
      .then((result) => {
        if (isCurrentRequest) setActivity(result)
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

  function renderBody() {
    if (isLoading) return <LoadingState message="Loading similar-article activity..." />
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the similar-article activity."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    if (activity.articlesChecked === 0) {
      return <EmptyState title="No articles yet" description="Collect news first." />
    }
    if (activity.matches.length === 0) {
      return (
        <EmptyState
          title="No classified pairs yet"
          description='Open an article and press "Classify these articles" under Similar Articles.'
        />
      )
    }

    const total = activity.matches.length
    return (
      <>
        <p className="result-count">
          {total} classified {total === 1 ? 'pair' : 'pairs'} · {activity.articlesWithMatches} of the{' '}
          {activity.articlesChecked} newest articles have one
        </p>
        <DistributionBar counts={activity.counts} total={total} />

        <h4 className="pol-subheading">Newest pairs</h4>
        <ul className="match-activity-list" aria-label="Newest classified pairs">
          {activity.matches.slice(0, MATCHES_TO_LIST).map((match) => (
            <li key={match.id} className="match-activity-item">
              <ClassificationBadge label={match.match_label} size="sm" />
              <div className="match-activity-pair">
                {[match.article_a, match.article_b].map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    className="sac-title-btn"
                    onClick={() => onOpenArticle(article.id, article.source_name || undefined)}
                    aria-label={`Open ${article.title} (${match.match_label} pair)`}
                  >
                    {article.title}
                    {article.source_name && (
                      <span className="ai-chip-extra"> · {article.source_name}</span>
                    )}
                  </button>
                ))}
              </div>
              {/* Similarity and confidence are different numbers, so they get different words */}
              <span className="ai-chip-extra match-activity-scores">
                Similarity {formatSimilarityPercentage(match.similarity_score) || 'not given'}
                {match.confidence_score !== null &&
                  ` · Confidence ${formatSimilarityPercentage(match.confidence_score)}`}
                {match.created_at && ` · ${formatDate(match.created_at)}`}
              </span>
            </li>
          ))}
        </ul>
        {activity.failedArticles > 0 && (
          <p className="ingestion-note">
            The matches of {activity.failedArticles}{' '}
            {activity.failedArticles === 1 ? 'article' : 'articles'} could not be loaded.
          </p>
        )}
      </>
    )
  }

  return (
    <Card
      title="Similar-Article Activity"
      subtitle={`SAME / RELATED / DIFFERENT pairs of the ${ARTICLES_TO_CHECK} newest articles`}
    >
      <div data-testid="match-activity-panel">
        {renderBody()}
        <p className="ad-section-note">
          Labels come from the backend&apos;s classifier and can be wrong. Similarity measures how
          alike the wording is; confidence is how sure the classifier is of its label.
        </p>
      </div>
    </Card>
  )
}

export default MatchActivityPanel
