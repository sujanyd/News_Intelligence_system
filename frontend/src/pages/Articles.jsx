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
import { getSourceName } from '../utils/getSourceName'

// How many articles to show on one page of the table
const ARTICLES_PER_PAGE = 5

// The backend has no title search, so a search looks through the newest
// articles instead. 100 is the most the backend sends in one request.
const SEARCH_POOL_SIZE = 100

// Keeps only the first article with each id, so no article is shown twice
function removeDuplicates(articleList) {
  const seenIds = new Set()
  return articleList.filter((article) => {
    if (seenIds.has(article.id)) return false
    seenIds.add(article.id)
    return true
  })
}

/**
 * Articles Page
 *
 * Two ways of loading, both through GET /articles:
 *
 * 1. Normal browsing (search box empty): the backend does the paging and the
 *    source filter:  GET /articles?limit=6&offset=...&source_id=...
 * 2. Searching (search box has text): the backend has no search option, so the
 *    page loads the newest 100 articles ONCE (with the source filter), then
 *    filters the titles and splits them into pages here in the browser.
 *    Typing does not send new requests.
 *
 * "Refresh articles" loads the list again from the backend and keeps the filters.
 * It never starts a news collection run (that is on the Dashboard).
 */
export function Articles() {
  // Data from the API
  const [articles, setArticles] = useState([])
  const [totalArticles, setTotalArticles] = useState(null) // null = backend did not say
  const [serverHasNextPage, setServerHasNextPage] = useState(false)
  const [sources, setSources] = useState([])
  const [sourcesError, setSourcesError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Page status
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // What the user picked
  const [searchText, setSearchText] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedArticleId, setSelectedArticleId] = useState(null)

  // Goes up by 1 on every "Refresh" or "Try again", which loads the data again
  const [reloadCount, setReloadCount] = useState(0)

  const searchWords = searchText.trim().toLowerCase()
  const isSearching = searchWords !== ''

  // In search mode the backend request does not depend on the page,
  // because the paging happens in the browser
  const requestPage = isSearching ? 1 : currentPage

  // Load the sources, for the filter and to show each article's source name
  useEffect(() => {
    fetchSources()
      .then((sourceList) => {
        setSources(sourceList)
        setSourcesError('')
      })
      .catch((error) => setSourcesError(error.message))
  }, [reloadCount])

  // Load the articles whenever the mode, page, source filter or reloadCount changes
  useEffect(() => {
    // Becomes false if the user moves on before this answer arrives,
    // so an old, slow answer can never replace a newer one
    let isCurrentRequest = true

    const sourceId = selectedSourceId === 'all' ? undefined : selectedSourceId
    const request = isSearching
      ? { limit: SEARCH_POOL_SIZE, offset: 0, sourceId }
      : {
          // Ask for one extra article: if it comes back, there is a next page
          limit: ARTICLES_PER_PAGE + 1,
          offset: (requestPage - 1) * ARTICLES_PER_PAGE,
          sourceId,
        }

    fetchArticles(request)
      .then((result) => {
        if (!isCurrentRequest) return
        const uniqueArticles = removeDuplicates(result.articles)
        if (isSearching) {
          setArticles(uniqueArticles)
        } else {
          setArticles(uniqueArticles.slice(0, ARTICLES_PER_PAGE))
          setServerHasNextPage(
            result.total !== null
              ? requestPage * ARTICLES_PER_PAGE < result.total
              : uniqueArticles.length > ARTICLES_PER_PAGE
          )
        }
        setTotalArticles(result.total)
        setLastUpdated(new Date())
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
  }, [isSearching, requestPage, selectedSourceId, reloadCount])

  // Show the spinner and clear old errors before a new request starts
  function startLoading() {
    setIsLoading(true)
    setErrorMessage('')
  }

  function handleRefresh() {
    if (isLoading) return // a request is already running
    startLoading()
    setReloadCount(reloadCount + 1)
  }

  function handleSearchChange(event) {
    const newText = event.target.value
    const willBeSearching = newText.trim() !== ''
    // Switching between browsing and searching needs a different request
    if (willBeSearching !== isSearching) startLoading()
    setSearchText(newText)
    setCurrentPage(1)
  }

  function clearSearch() {
    if (isSearching) startLoading()
    setSearchText('')
    setCurrentPage(1)
  }

  function handlePageChange(newPage) {
    // In search mode the pages are already loaded, so no request is needed
    if (!isSearching) startLoading()
    setCurrentPage(newPage)
  }

  function handleSourceChange(event) {
    startLoading()
    setSelectedSourceId(event.target.value)
    setCurrentPage(1)
  }

  function handleViewArticle(article) {
    setSelectedArticleId(article.id)
    // Jump to the top of the page, where the details panel appears
    window.scrollTo(0, 0)
  }

  // Search mode: filter the loaded titles, then cut out the current page
  const matchingArticles = isSearching
    ? articles.filter((article) => article.title.toLowerCase().includes(searchWords))
    : articles
  const firstIndex = (currentPage - 1) * ARTICLES_PER_PAGE
  const pageArticles = isSearching
    ? matchingArticles.slice(firstIndex, firstIndex + ARTICLES_PER_PAGE)
    : articles

  let hasNextPage = serverHasNextPage
  let totalPages = totalArticles !== null ? Math.ceil(totalArticles / ARTICLES_PER_PAGE) : null
  if (isSearching) {
    hasNextPage = firstIndex + ARTICLES_PER_PAGE < matchingArticles.length
    totalPages = Math.max(1, Math.ceil(matchingArticles.length / ARTICLES_PER_PAGE))
  }

  const selectedArticle = articles.find((article) => article.id === selectedArticleId)
  const selectedSource = sources.find((source) => String(source.id) === selectedSourceId)

  // What each column of the table shows
  const columns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source', label: 'Source', render: (article) => getSourceName(article, sources) },
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

  // e.g. "Showing articles 6–10" or "Showing 1–5 of 12 matches for "budget""
  function renderResultCount() {
    const first = firstIndex + 1
    const last = firstIndex + pageArticles.length
    if (isSearching) {
      const matchWord = matchingArticles.length === 1 ? 'match' : 'matches'
      return `Showing ${first}–${last} of ${matchingArticles.length} ${matchWord} for "${searchText.trim()}"`
    }
    const total = totalArticles !== null ? ` of ${totalArticles}` : ''
    return `Showing articles ${first}–${last}${total}`
  }

  // Decide what to show inside the card
  function renderArticleList() {
    if (isLoading) {
      return <LoadingState message={isSearching ? 'Searching articles...' : 'Loading articles...'} />
    }

    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load articles."
          message={errorMessage}
          onRetry={handleRefresh}
        />
      )
    }

    if (isSearching && matchingArticles.length === 0) {
      return (
        <EmptyState
          title={`No articles match "${searchText.trim()}"`}
          description="Try another word, choose another source, or clear the search."
          action={
            <button type="button" className="btn btn-secondary" onClick={clearSearch}>
              Clear search
            </button>
          }
        />
      )
    }

    if (pageArticles.length === 0) {
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

    return (
      <>
        <p className="result-count">{renderResultCount()}</p>
        <DataTable columns={columns} rows={pageArticles} caption="List of articles" />
        {pagination}
      </>
    )
  }

  const refreshButton = (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={handleRefresh}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <span className="loading-spinner-wrap">
          <span className="spinner" aria-hidden="true" /> Refreshing...
        </span>
      ) : (
        'Refresh articles'
      )}
    </button>
  )

  return (
    <div className="page-articles">
      <PageHeader
        title="Articles"
        description="Browse collected news articles, search them by title and filter them by source."
        badge={<DataModeBadge />}
      />

      {selectedArticle && (
        <ArticleDetails
          key={selectedArticle.id}
          articleId={selectedArticle.id}
          sourceName={getSourceName(selectedArticle, sources)}
          onClose={() => setSelectedArticleId(null)}
        />
      )}

      <Card
        title="All Articles"
        subtitle={
          lastUpdated
            ? `Last updated ${lastUpdated.toLocaleTimeString()}`
            : 'Search by title or filter by source'
        }
        badge={refreshButton}
      >
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

        {isSearching && (
          <p className="search-note">
            The backend has no title search yet, so this searches the newest{' '}
            {SEARCH_POOL_SIZE} articles
            {selectedSource ? ` from ${selectedSource.name}` : ''}.
          </p>
        )}

        {renderArticleList()}
      </Card>
    </div>
  )
}

export default Articles
