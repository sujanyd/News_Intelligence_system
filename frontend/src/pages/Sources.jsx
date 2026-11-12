import React, { useContext, useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import DataModeBadge from '../components/DataModeBadge'
import AddSourceForm from '../components/AddSourceForm'
import RssFeedList from '../components/RssFeedList'
import { fetchSourceActivity, fetchSources } from '../api/newsApi'
import { NavigationContext } from '../navigation'
import { formatDate } from '../utils/formatDate'

// "84 articles", or "2000+ articles" when the count stopped early
function formatArticleCount({ count, isComplete }) {
  return `${count}${isComplete ? '' : '+'} ${count === 1 ? 'article' : 'articles'}`
}

/**
 * Sources Page
 *
 * Shows the list of news sources (GET /sources), how many articles each one
 * has and its newest article (GET /articles?source_id=..., see
 * fetchSourceActivity), a form to add a new source, and the RSS feeds the
 * news collection reads. "View articles" opens the Articles page filtered to
 * that source. The backend stores no status for a source, so none is shown.
 */
export function Sources() {
  const navigate = useContext(NavigationContext)
  // { [sourceId]: { count, isComplete, newest } | { error } }
  const [activity, setActivity] = useState({})
  const [sources, setSources] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Goes up by 1 to load the list again ("Try again", or after adding a source)
  const [reloadCount, setReloadCount] = useState(0)

  // Load the sources when the page opens, and again whenever reloadCount changes
  useEffect(() => {
    let isCurrentRequest = true
    fetchSources()
      .then((sourceList) => {
        if (!isCurrentRequest) return
        setSources(sourceList)
        // Then each source's article count and newest article. One failing
        // source only shows "Not loaded" in its own row.
        for (const source of sourceList) {
          fetchSourceActivity(source.id)
            .then((result) => {
              if (isCurrentRequest) setActivity((old) => ({ ...old, [source.id]: result }))
            })
            .catch((error) => {
              if (isCurrentRequest) {
                setActivity((old) => ({ ...old, [source.id]: { error: error.message } }))
              }
            })
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
  }, [reloadCount])

  // Go back to the loading state and ask the backend for the list again
  function reloadSources() {
    setIsLoading(true)
    setErrorMessage('')
    setActivity({})
    setReloadCount(reloadCount + 1)
  }

  // After the form saves a new source, load the list again so it shows
  // exactly what the backend has stored (in the backend's order)
  function handleSourceAdded() {
    reloadSources()
  }

  const columns = [
    { key: 'name', label: 'Name', render: (source) => <strong>{source.name}</strong> },
    {
      key: 'base_url',
      label: 'Base URL',
      render: (source) => (
        <a href={source.base_url} target="_blank" rel="noreferrer" className="table-link">
          {source.base_url}
        </a>
      ),
    },
    {
      key: 'articles',
      label: 'Articles',
      render: (source) => {
        const info = activity[source.id]
        if (!info) return <span className="ai-chip-extra">Counting...</span>
        if (info.error) return <span className="ai-chip-extra">Not loaded</span>
        return formatArticleCount(info)
      },
    },
    {
      key: 'newest',
      label: 'Newest article',
      render: (source) => {
        const info = activity[source.id]
        if (!info || info.error) return <span className="ai-chip-extra">--</span>
        if (!info.newest) return <span className="ai-chip-extra">None yet</span>
        return (
          <>
            {info.newest.title}
            <span className="coverage-timeline-time">
              Published {formatDate(info.newest.published_at)}
            </span>
          </>
        )
      },
    },
    { key: 'created_at', label: 'Added on', render: (source) => formatDate(source.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      render: (source) =>
        navigate ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('articles', { sourceId: source.id })}
            aria-label={`View articles from ${source.name}`}
          >
            View articles
          </button>
        ) : null,
    },
  ]

  // Decide what to show inside the list card
  function renderSourceList() {
    if (isLoading) {
      return <LoadingState message="Loading sources..." />
    }

    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load sources."
          message={errorMessage}
          onRetry={reloadSources}
        />
      )
    }

    if (sources.length === 0) {
      return (
        <EmptyState
          title="No news sources configured yet"
          description="Use the form to add your first news source."
        />
      )
    }

    return <DataTable columns={columns} rows={sources} caption="List of news sources" />
  }

  return (
    <div className="page-sources">
      <PageHeader
        title="News Sources"
        description="The publishers news is collected from."
        badge={<DataModeBadge />}
      />

      <div className="sources-layout">
        <Card
          title="Configured Sources"
          subtitle={
            isLoading ? 'Loading...' : errorMessage ? 'Not loaded' : `${sources.length} sources`
          }
        >
          {renderSourceList()}
        </Card>

        <Card title="Add a Source" subtitle="Fields marked * are required">
          <AddSourceForm onSourceAdded={handleSourceAdded} />
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <RssFeedList />
      </div>
    </div>
  )
}

export default Sources
