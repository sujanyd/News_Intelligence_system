import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import Card from '../components/Card'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import EmptyState from '../components/EmptyState'
import ArticleMatchingSection from '../components/ArticleMatchingSection'
import { fetchArticles } from '../api/newsApi'

// How many of the newest articles the picker lists (the backend sends at most 100)
const PICKER_ARTICLE_LIMIT = 100

/**
 * Comparisons Page
 *
 * Primary interface for reviewing article matching pairs and classifications:
 * - The backend stores matches per article, so the user first picks an article.
 * - Displays its matched pairs with SAME, RELATED, and DIFFERENT labels.
 * - "Run matching" classifies the article's nearest articles.
 * - Allows side-by-side inspection of paired articles.
 */
export function Comparisons() {
  const [articles, setArticles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [selectedArticleId, setSelectedArticleId] = useState('')

  // Load the newest articles for the picker
  useEffect(() => {
    let isCurrentRequest = true
    fetchArticles({ limit: PICKER_ARTICLE_LIMIT, offset: 0 })
      .then((result) => {
        if (isCurrentRequest) setArticles(result.articles)
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

  function renderPicker() {
    if (isLoading) {
      return <LoadingState message="Loading articles..." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load articles."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    if (articles.length === 0) {
      return (
        <EmptyState
          title="No articles collected yet"
          description="Run News Collection on the Dashboard first, then come back to compare articles."
        />
      )
    }
    return (
      <div className="form-field">
        <label htmlFor="comparison-article" className="form-label">
          Article to compare
        </label>
        <select
          id="comparison-article"
          className="form-input"
          value={selectedArticleId}
          onChange={(event) => setSelectedArticleId(event.target.value)}
        >
          <option value="">Choose an article...</option>
          {articles.map((article) => (
            <option key={article.id} value={String(article.id)}>
              {article.source_name ? `${article.source_name}: ` : ''}
              {article.title}
            </option>
          ))}
        </select>
        <p className="ingestion-note">
          Lists the newest {PICKER_ARTICLE_LIMIT} articles.
        </p>
      </div>
    )
  }

  return (
    <div className="page-comparisons" data-testid="page-comparisons">
      <PageHeader
        title="Comparisons"
        description="Review pairwise semantic matches, compare coverage side-by-side, and inspect SAME, RELATED, or DIFFERENT event classifications."
        badge={<StatusBadge variant="primary">Pairwise Matching</StatusBadge>}
      />

      <Card title="Choose an article" subtitle="Matches are stored for one article at a time">
        {renderPicker()}
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <ArticleMatchingSection
          key={selectedArticleId || 'none'}
          articleId={selectedArticleId || undefined}
          title="Pairwise Matching & Classification Results"
        />
      </div>
    </div>
  )
}

export default Comparisons
