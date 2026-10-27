import React, { useEffect, useState } from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import { fetchArticle } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

/**
 * ArticleDetails Component
 *
 * Loads one article from the backend (GET /articles/{id}) and shows
 * its full information. (Bias and framing analysis comes in a later milestone.)
 *
 * @param {Object} props
 * @param {number | string} props.articleId - Which article to show
 * @param {string} props.sourceName - Name of the article's source
 * @param {() => void} props.onClose - Called when "Close" is clicked
 */
export function ArticleDetails({ articleId, sourceName, onClose }) {
  const [article, setArticle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    fetchArticle(articleId)
      .then((result) => {
        if (isCurrentRequest) setArticle(result)
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

  const closeButton = (
    <button type="button" className="btn btn-secondary" onClick={onClose}>
      Close
    </button>
  )

  function renderBody() {
    if (isLoading) {
      return <LoadingState message="Loading article..." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load this article."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    return (
      <>
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
              {article.url ? (
                <a href={article.url} target="_blank" rel="noreferrer" className="table-link">
                  {article.url}
                </a>
              ) : (
                'Not available'
              )}
            </dd>
          </div>
        </dl>

        <h4 className="details-heading">Content</h4>
        {article.contentStatus === 'available' ? (
          <p className="details-content">{article.content}</p>
        ) : (
          <StatusBadge variant="warning">Content not available for this article</StatusBadge>
        )}
      </>
    )
  }

  return (
    <section aria-label="Article details" className="article-details">
      <Card
        title={article ? article.title : 'Article details'}
        subtitle={sourceName}
        badge={closeButton}
      >
        {renderBody()}
      </Card>
    </section>
  )
}

export default ArticleDetails
