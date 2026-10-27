import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
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
 * Shows all collected articles in a table with:
 * - a search box (by title)
 * - a source filter
 * - Previous / Next pages
 * - a "View" button to see one article
 */
export function Articles() {
  // Data from the API
  const [articles, setArticles] = useState([])
  const [sources, setSources] = useState([])

  // Page status
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // What the user picked
  const [searchText, setSearchText] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedArticle, setSelectedArticle] = useState(null)

  // Goes up by 1 every time "Try again" is clicked, which loads the data again
  const [reloadCount, setReloadCount] = useState(0)

  // Load articles and sources when the page opens (and again after "Try again")
  useEffect(() => {
    Promise.all([fetchArticles(), fetchSources()])
      .then(([articleList, sourceList]) => {
        setArticles(articleList)
        setSources(sourceList)
      })
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setIsLoading(false))
  }, [reloadCount])

  // "Try again" button: go back to the loading state and load again
  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  function handleSearchChange(event) {
    setSearchText(event.target.value)
    setCurrentPage(1)
  }

  function handleSourceChange(event) {
    setSelectedSourceId(event.target.value)
    setCurrentPage(1)
  }

  function handleViewArticle(article) {
    setSelectedArticle(article)
    // Jump to the top of the page, where the details panel appears
    window.scrollTo(0, 0)
  }

  function clearFilters() {
    setSearchText('')
    setSelectedSourceId('all')
    setCurrentPage(1)
  }

  // Keep only the articles that match the search and the chosen source
  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchText.trim().toLowerCase())
    const matchesSource =
      selectedSourceId === 'all' || String(article.source_id) === selectedSourceId
    return matchesSearch && matchesSource
  })

  // Cut the list into pages
  const totalPages = Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE)
  const firstIndex = (currentPage - 1) * ARTICLES_PER_PAGE
  const articlesOnThisPage = filteredArticles.slice(firstIndex, firstIndex + ARTICLES_PER_PAGE)

  // What each column of the table shows
  const columns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source_name', label: 'Source' },
    {
      key: 'published_at',
      label: 'Published',
      render: (article) => formatDate(article.published_at),
    },
    {
      key: 'content',
      label: 'Content',
      render: (article) =>
        article.content ? (
          <StatusBadge variant="success">Available</StatusBadge>
        ) : (
          <StatusBadge variant="warning">Missing</StatusBadge>
        ),
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
      return (
        <EmptyState
          title="No articles collected yet"
          description="Articles will appear here once the news collection pipeline has fetched them."
        />
      )
    }

    if (filteredArticles.length === 0) {
      return (
        <EmptyState
          title="No articles match your filters"
          description="Try a different search word or source."
          action={
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      )
    }

    return (
      <>
        <p className="result-count">
          Showing {articlesOnThisPage.length} of {filteredArticles.length} articles
        </p>
        <DataTable columns={columns} rows={articlesOnThisPage} caption="List of articles" />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </>
    )
  }

  return (
    <div className="page-articles">
      <PageHeader
        title="Articles"
        description="Browse collected news articles, search by title, and filter by source."
        badge={<DataModeBadge />}
      />

      {selectedArticle && (
        <ArticleDetails article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      <Card title="All Articles" subtitle="Search and filter collected articles">
        <div className="filter-bar">
          <div className="form-field">
            <label htmlFor="article-search" className="form-label">
              Search by title
            </label>
            <input
              id="article-search"
              type="search"
              className="form-input"
              placeholder="e.g. budget"
              value={searchText}
              onChange={handleSearchChange}
              disabled={isLoading}
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
              disabled={isLoading}
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={String(source.id)}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {renderArticleList()}
      </Card>
    </div>
  )
}

export default Articles
