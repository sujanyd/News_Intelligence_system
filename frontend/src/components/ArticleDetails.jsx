import React from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import { formatDate } from '../utils/formatDate'

/**
 * ArticleDetails Component
 *
 * Shows the full information of one article after "View" is clicked.
 * (Bias and framing analysis will be added in a later milestone.)
 *
 * @param {Object} props
 * @param {Object} props.article - The article to show
 * @param {() => void} props.onClose - Called when "Close" is clicked
 */
export function ArticleDetails({ article, onClose }) {
  const hasContent = Boolean(article.content)

  return (
    <section aria-label="Article details" className="article-details">
      <Card
        title={article.title}
        subtitle={article.source_name}
        badge={
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      >
        <dl className="details-list">
          <div>
            <dt>Published</dt>
            <dd>{formatDate(article.published_at)}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{formatDate(article.retrieved_at)}</dd>
          </div>
          <div>
            <dt>Original link</dt>
            <dd>
              <a href={article.url} target="_blank" rel="noreferrer" className="table-link">
                {article.url}
              </a>
            </dd>
          </div>
        </dl>

        <h4 className="details-heading">Content</h4>
        {hasContent ? (
          <p className="details-content">{article.content}</p>
        ) : (
          <StatusBadge variant="warning">Content not available for this article</StatusBadge>
        )}
      </Card>
    </section>
  )
}

export default ArticleDetails
