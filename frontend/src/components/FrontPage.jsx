import React from 'react'
import ContentAvailabilityBadge from './ContentAvailabilityBadge'
import { formatDate } from '../utils/formatDate'

/**
 * FrontPage Component
 *
 * The newest articles laid out like a newspaper front page: the first one as
 * the lead story with a large headline, the others in ruled columns. Every
 * headline is a button that opens the article's details.
 *
 * Only what the backend sends is shown: headline, publisher, date and how
 * much of the text was collected. Nothing is written for the reader.
 *
 * @param {Object} props
 * @param {Array} props.articles - newest first
 * @param {(article) => string} props.getSource - publisher name of an article
 * @param {(articleId: number) => void} props.onOpen
 */
export function FrontPage({ articles, getSource, onOpen }) {
  return (
    <ol className="fp" aria-label="Most recent articles">
      {articles.map((article, index) => (
        <li key={article.id} className={index === 0 ? 'fp-story fp-lead' : 'fp-story'}>
          <p className="fp-kicker">
            <span className="fp-source">{getSource(article)}</span>
            <span className="fp-date">{formatDate(article.published_at)}</span>
          </p>
          <h3 className="fp-headline">
            <button
              type="button"
              className="fp-headline-btn"
              onClick={() => onOpen(article.id)}
              aria-label={`View details for ${article.title}`}
            >
              {article.title}
            </button>
          </h3>
          <div className="fp-meta">
            <ContentAvailabilityBadge availability={article.content_availability} />
            {index === 0 && <span className="fp-read" aria-hidden="true">Read the analysis →</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default FrontPage
