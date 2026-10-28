import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import ContentAvailabilityBadge from '../components/ContentAvailabilityBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import DataModeBadge from '../components/DataModeBadge'
import ArticleDetails from '../components/ArticleDetails'
import { fetchArticles, fetchSources } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

// How many articles to show on one page of the table
const ARTICLES_PER_PAGE = 5

/**
 * Articles Page
 *
 * Asks the backend for one page of articles at a time:
 *   GET /articles?limit=...&offset=...&source_id=...
 * The source filter and Previous / Next buttons change that request.
 * The search box only filters the articles already on the screen,
 * because the backend has no search option (yet).
 */
export function Articles() {
  // Data from the API
  const [articles, setArticles] = useState([])
  const [totalArticles, setTotalArticles] = useState(null) // null = backend did not say
  const [hasNextPage, setHasNextPage] = useState(false)
  const [sources, setSources] = useState([])
  const [sourcesError, setSourcesError] = useState('')

  // Page status
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // What the user picked
  const [searchText, setSearchText] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedArticleId, setSelectedArticleId] = useState(null)

  // Goes up by 1 every time "Try again" is clicked, which loads the data again
  const [reloadCount, setReloadCount] = useState(0)

  // Load the sources once, for the filter and to show each article's source name
  useEffect(() => {
    fetchSources()
      .then((sourceList) => setSources(sourceList))
      .catch((error) => setSourcesError(error.message))
  }, [])

  // Load one page of articles whenever the page, the source filter or reloadCount changes
  useEffect(() => {
    // Becomes false if the user moves on before this answer arrives,
    // so an old, slow answer can never replace a newer one
    let isCurrentRequest = true

    fetchArticles({
      // Ask for one extra article: if it comes back, there is a next page
      limit: ARTICLES_PER_PAGE + 1,
      offset: (currentPage - 1) * ARTICLES_PER_PAGE,
      sourceId: selectedSourceId === 'all' ? undefined : selectedSourceId,
    })
      .then((result) => {
        if (!isCurrentRequest) return
        setArticles(result.articles.slice(0, ARTICLES_PER_PAGE))
        setTotalArticles(result.total)
        if (result.total !== null) {
          setHasNextPage(currentPage * ARTICLES_PER_PAGE < result.total)
        } else {
          setHasNextPage(result.articles.length > ARTICLES_PER_PAGE)
        }
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
  }, [currentPage, selectedSourceId, reloadCount])

  // Show the spinner and clear old errors before a new request starts
  function startLoading() {
    setIsLoading(true)
    setErrorMessage('')
  }

  function handleRetry() {
    startLoading()
    setReloadCount(reloadCount + 1)
  }

  function handlePageChange(newPage) {
    startLoading()
    setSearchText('')
    setCurrentPage(newPage)
  }

  function handleSourceChange(event) {
    startLoading()
    setSearchText('')
    setSelectedSourceId(event.target.value)
    setCurrentPage(1)
  }

  function handleViewArticle(article) {
    setSelectedArticleId(article.id)
    // Jump to the top of the page, where the details panel appears
    window.scrollTo(0, 0)
  }

  // The Article model only has source_id, so look the name up in the sources list
  function getSourceName(article) {
    if (article.source_name) return article.source_name
    const source = sources.find((item) => String(item.id) === String(article.source_id))
    if (source) return source.name
    if (article.source_id !== null) return `Source #${article.source_id}`
    return 'Unknown source'
  }

  // The search box only filters the articles on this page
  const visibleArticles = articles.filter((article) =>
    article.title.toLowerCase().includes(searchText.trim().toLowerCase())
  )

  const totalPages = totalArticles !== null ? Math.ceil(totalArticles / ARTICLES_PER_PAGE) : null
  const selectedArticle = articles.find((article) => article.id === selectedArticleId)

  // What each column of the table shows
  const columns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source', label: 'Source', render: (article) => getSourceName(article) },
    {
      key: 'published_at',
      label: 'Published',
      render: (article) => formatDate(article.published_at),
    },
    {
      key: 'content_availability',
      label: 'Content',
      render: (article) => <ContentAvailabilityBadge availability={article.content_availability} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (article) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleViewArticle(article)}
          aria-label={`View details for ${article.title}`}
        >
          View
        </button>
      ),
    },
  ]

  const pagination = (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      hasNextPage={hasNextPage}
      onPageChange={handlePageChange}
    />
  )

  // Decide what to show inside the card
  function renderArticleList() {
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
      let title = 'No articles collected yet'
      let description = 'Articles will appear here once the news collection pipeline has fetched them.'
      if (currentPage > 1) {
        title = 'No more articles'
        description = 'There are no articles on this page. Go back to the previous page.'
      } else if (selectedSourceId !== 'all') {
        title = 'No articles from this source yet'
        description = 'Choose "All sources" to see articles from every source.'
      }
      return (
        <>
          <EmptyState title={title} description={description} />
          {pagination}
        </>
      )
    }

    if (visibleArticles.length === 0) {
      return (
        <EmptyState
          title="No articles on this page match your search"
          description="The search only looks at the articles on this page."
          action={
            <button type="button" className="btn btn-secondary" onClick={() => setSearchText('')}>
              Clear search
            </button>
          }
        />
      )
    }

    return (
      <>
        <p className="result-count">
          Showing {visibleArticles.length} articles on page {currentPage}
          {totalArticles !== null && ` (${totalArticles} in total)`}
        </p>
        <DataTable columns={columns} rows={visibleArticles} caption="List of articles" />
        {pagination}
      </>
    )
  }

  return (
    <div className="page-articles">
      <PageHeader
        title="Articles"
        description="Browse collected news articles and filter them by source."
        badge={<DataModeBadge />}
      />

      {selectedArticle && (
        <ArticleDetails
          key={selectedArticle.id}
          articleId={selectedArticle.id}
          sourceName={getSourceName(selectedArticle)}
          onClose={() => setSelectedArticleId(null)}
        />
      )}

      <Card title="All Articles" subtitle="Filter by source, or search the titles on this page">
        <div className="filter-bar">
          <div className="form-field">
            <label htmlFor="article-search" className="form-label">
              Search titles on this page
            </label>
            <input
              id="article-search"
              type="search"
              className="form-input"
              placeholder="e.g. budget"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              disabled={isLoading || Boolean(errorMessage)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="article-source-filter" className="form-label">
              Source
            </label>
            <select
              id="article-source-filter"
              className="form-input"
              value={selectedSourceId}
              onChange={handleSourceChange}
              disabled={isLoading || Boolean(sourcesError)}
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={String(source.id)}>
                  {source.name}
                </option>
              ))}
            </select>
            {sourcesError && (
              <p className="form-hint">Source filter unavailable: {sourcesError}</p>
            )}
          </div>
        </div>

        {renderArticleList()}
      </Card>
    </div>
  )
}

export default Articles
