import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import StoryReport from '../components/StoryReport'
import { fetchAllStories, STORIES_AVAILABLE } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { REPORT_ARTICLE_LIMIT } from '../utils/coverage'

/**
 * Reports Page
 *
 * One evidence-based report per story. The backend has no report route, so
 * the list is the backend's stories (GET /stories, all pages) and a report
 * is put together in the browser from real backend data (see StoryReport).
 * There is no download: the backend has no export.
 */
export function Reports() {
  const [stories, setStories] = useState([])
  const [isComplete, setIsComplete] = useState(true)
  const [isLoading, setIsLoading] = useState(STORIES_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [openStoryId, setOpenStoryId] = useState(null)
  const [showSingleArticle, setShowSingleArticle] = useState(false)

  useEffect(() => {
    if (!STORIES_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchAllStories()
      .then((result) => {
        if (!isCurrentRequest) return
        // Most covered stories first
        setStories([...result.items].sort((x, y) => y.article_count - x.article_count))
        setIsComplete(result.isComplete)
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

  const shownStories = showSingleArticle ? stories : stories.filter((story) => story.article_count >= 2)

  const columns = [
    { key: 'title', label: 'Story', render: (story) => <strong>{story.title}</strong> },
    { key: 'articles', label: 'Articles', render: (story) => story.article_count },
    { key: 'events', label: 'Events', render: (story) => story.event_count },
    { key: 'created', label: 'Grouped on', render: (story) => formatDate(story.created_at) },
    {
      key: 'open',
      label: 'Report',
      render: (story) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpenStoryId(story.id)}
          aria-label={`Open the report for ${story.title}`}
        >
          Open report
        </button>
      ),
    },
  ]

  function renderList() {
    if (!STORIES_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Reports need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There are no sample reports."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading stories..." />
    if (errorMessage) {
      return <AlertMessage type="error" title="Could not load the stories." message={errorMessage} onRetry={handleRetry} />
    }
    if (stories.length === 0) {
      return (
        <EmptyState
          title="No stories yet"
          description='Collect news on the Dashboard, then use "Group articles" on the Stories page.'
        />
      )
    }
    return (
      <>
        <label className="rep-toggle">
          <input
            type="checkbox"
            checked={showSingleArticle}
            onChange={(event) => setShowSingleArticle(event.target.checked)}
          />{' '}
          Also show stories with only one article
        </label>
        {shownStories.length === 0 ? (
          <EmptyState
            title="No story has two or more articles"
            description="Tick the box above to see single-article stories."
          />
        ) : (
          <DataTable columns={columns} rows={shownStories} caption="Stories with a report" />
        )}
        {!isComplete && (
          <p className="ingestion-note">Only the first {stories.length} stories are listed.</p>
        )}
      </>
    )
  }

  return (
    <div className="page-reports" data-testid="page-reports">
      <PageHeader
        title="Reports"
        description="Evidence-based reports about one story: its events, publishers, coverage, framing differences, evidence and limitations."
        badge={<StatusBadge variant="info">Built from backend data</StatusBadge>}
      />

      {openStoryId !== null ? (
        <Card title="Story report">
          <StoryReport key={openStoryId} storyId={openStoryId} onBack={() => setOpenStoryId(null)} />
        </Card>
      ) : (
        <Card
          title="Available reports"
          subtitle={
            isLoading || errorMessage || !STORIES_AVAILABLE
              ? undefined
              : `${shownStories.length} of ${stories.length} stories`
          }
        >
          {renderList()}
          <p className="ad-section-note">
            The backend has no report route, so a report is put together in your browser from the
            story and the analyses of up to {REPORT_ARTICLE_LIMIT} of its articles. It is not saved,
            and there is no download because the backend has no export.
          </p>
        </Card>
      )}
    </div>
  )
}

export default Reports
