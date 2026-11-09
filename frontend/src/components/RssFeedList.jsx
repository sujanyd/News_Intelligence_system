import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { fetchIngestionFeeds, INGESTION_AVAILABLE } from '../api/newsApi'

/**
 * RssFeedList Component
 *
 * The RSS feeds that "Run News Collection" (on the Dashboard) reads.
 * Data: GET /ingestion/feeds. The backend does not store when a collection
 * last ran, so no "last run" time can be shown.
 */
export function RssFeedList() {
  const [feeds, setFeeds] = useState([])
  const [isLoading, setIsLoading] = useState(INGESTION_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!INGESTION_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchIngestionFeeds()
      .then((feedList) => {
        if (isCurrentRequest) setFeeds(feedList)
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

  const columns = [
    { key: 'source_name', label: 'Publisher', render: (feed) => <strong>{feed.source_name}</strong> },
    {
      key: 'feed_url',
      label: 'RSS feed',
      render: (feed) =>
        feed.feed_url ? (
          <a href={feed.feed_url} target="_blank" rel="noreferrer" className="table-link">
            {feed.feed_url}
          </a>
        ) : (
          'Not given'
        ),
    },
  ]

  function renderBody() {
    if (!INGESTION_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="The RSS feed list needs the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading RSS feeds..." />
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the RSS feeds."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    if (feeds.length === 0) {
      return (
        <EmptyState
          title="No RSS feeds configured"
          description="The backend has no default feeds, so News Collection has nothing to read."
        />
      )
    }
    return (
      <>
        <DataTable
          columns={columns}
          rows={feeds.map((feed, index) => ({ ...feed, id: `${feed.source_name}-${index}` }))}
          caption="RSS feeds read by News Collection"
        />
        <p className="ingestion-note">
          Start a collection with &quot;Run News Collection&quot; on the Dashboard. The backend
          does not record when the last collection ran.
        </p>
      </>
    )
  }

  return (
    <Card
      title="RSS Feeds"
      subtitle={isLoading ? 'Loading...' : errorMessage ? 'Not loaded' : `${feeds.length} feeds read by News Collection`}
    >
      {renderBody()}
    </Card>
  )
}

export default RssFeedList
