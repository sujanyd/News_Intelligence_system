import React from 'react'
import StatusBadge from './StatusBadge'
import { formatDate } from '../utils/formatDate'
import { countPublishers } from '../utils/publishers'

/**
 * PublisherList Component
 *
 * The publishers that covered a story or event, with their article counts.
 * A count is how many articles were collected, not how important or how
 * biased a publisher is.
 *
 * @param {Object} props
 * @param {Array} props.articles
 */
export function PublisherList({ articles }) {
  const publishers = countPublishers(articles)
  if (publishers.length === 0) return <p className="ai-none">No publisher yet.</p>
  return (
    <ul className="publisher-list" aria-label="Publishers covering this">
      {publishers.map((publisher) => (
        <li key={publisher.name}>
          <StatusBadge variant="neutral">
            {publisher.name} · {publisher.count} {publisher.count === 1 ? 'article' : 'articles'}
          </StatusBadge>
        </li>
      ))}
    </ul>
  )
}

/**
 * CoverageTimeline Component
 *
 * The articles in the order they were PUBLISHED, earliest first. This is
 * the publication time each publisher gave, not the time the event
 * happened (that is shown separately as "When it happened").
 * Articles without a publication time come last.
 *
 * @param {Object} props
 * @param {Array} props.articles
 * @param {(article: Object) => void} [props.onViewArticle]
 */
export function CoverageTimeline({ articles, onViewArticle }) {
  const time = (article) =>
    article.published_at ? new Date(article.published_at).getTime() : Number.POSITIVE_INFINITY
  const ordered = [...articles].sort((a, b) => time(a) - time(b))

  if (ordered.length === 0) return <p className="ai-none">No articles yet.</p>

  return (
    <>
      <ol className="coverage-timeline" aria-label="Publication timeline">
        {ordered.map((article) => (
          <li key={article.id} className="coverage-timeline-item">
            <span className="coverage-timeline-time">
              {article.published_at ? `Published ${formatDate(article.published_at)}` : 'Publication time not given'}
              {' · '}
              {article.source_name || 'Unknown publisher'}
            </span>
            {onViewArticle ? (
              <button
                type="button"
                className="sac-title-btn"
                onClick={() => onViewArticle(article)}
                aria-label={`Read ${article.title} (timeline)`}
              >
                {article.title}
              </button>
            ) : (
              <strong>{article.title}</strong>
            )}
          </li>
        ))}
      </ol>
      <p className="ad-section-note">
        These are publication times from each publisher, not the time the event happened.
      </p>
    </>
  )
}

export default CoverageTimeline
