import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import DataModeBadge from '../components/DataModeBadge'
import AddSourceForm from '../components/AddSourceForm'
import { fetchSources } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

/**
 * Sources Page
 *
 * Shows the list of news sources and a form to add a new one.
 */
export function Sources() {
  const [sources, setSources] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Goes up by 1 every time "Try again" is clicked, which loads the data again
  const [reloadCount, setReloadCount] = useState(0)

  // Load the sources when the page opens (and again after "Try again")
  useEffect(() => {
    fetchSources()
      .then((sourceList) => setSources(sourceList))
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setIsLoading(false))
  }, [reloadCount])

  // "Try again" button: go back to the loading state and load again
  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  // When the form saves a new source, add it to the end of the list
  function handleSourceAdded(newSource) {
    setSources([...sources, newSource])
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
    { key: 'created_at', label: 'Added on', render: (source) => formatDate(source.created_at) },
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
          onRetry={handleRetry}
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
        description="See the news outlets the system collects from, and add new ones."
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
    </div>
  )
}

export default Sources
