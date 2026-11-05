import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { PrecisionBadge, TimeAgreementBadge } from './EventTimeInfo'
import { fetchStory } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { formatEventTime, getUniqueSourceNames, sortEventsByTime } from '../utils/formatEventTime'

/**
 * StoryDetails Component
 *
 * Loads one story from GET /stories/{id} and shows:
 *   1. The story: title, when it was created, counts and sources
 *   2. Its events, from earliest to latest, each with an "Open" button
 *   3. Its articles, each with a button for the event it belongs to
 *
 * The backend has no story description and no event titles, so events are
 * called "Event 12" (their id).
 *
 * @param {Object} props
 * @param {number} props.storyId - Which story to load
 * @param {() => void} props.onBack - Back to the stories list
 * @param {(eventId: number) => void} props.onOpenEvent - Open one event
 */
export function StoryDetails({ storyId, onBack, onOpenEvent }) {
  const [story, setStory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    fetchStory(storyId)
      .then((loadedStory) => {
        if (isCurrentRequest) setStory(loadedStory)
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
  }, [storyId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  const backButton = (
    <button type="button" className="btn btn-secondary story-back" onClick={onBack}>
      ← All stories
    </button>
  )

  if (isLoading) {
    return (
      <>
        {backButton}
        <LoadingState message="Loading story..." />
      </>
    )
  }

  if (errorMessage) {
    return (
      <>
        {backButton}
        <AlertMessage
          type="error"
          title="Could not load this story."
          message={errorMessage}
          onRetry={handleRetry}
        />
      </>
    )
  }

  const sourceNames = getUniqueSourceNames(story.articles)
  const events = sortEventsByTime(story.events)

  const eventColumns = [
    { key: 'name', label: 'Event', render: (event) => <strong>Event {event.id}</strong> },
    { key: 'time', label: 'When', render: formatEventTime },
    {
      key: 'precision',
      label: 'Time precision',
      render: (event) => <PrecisionBadge precision={event.event_time_precision} />,
    },
    {
      key: 'agreement',
      label: 'Sources on the time',
      render: (event) => <TimeAgreementBadge disagreement={event.event_time_disagreement} />,
    },
    { key: 'article_count', label: 'Articles' },
    {
      key: 'actions',
      label: 'Actions',
      render: (event) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpenEvent(event.id)}
          aria-label={`Open event ${event.id}`}
        >
          Open
        </button>
      ),
    },
  ]

  const articleColumns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source', label: 'Source', render: (article) => article.source_name || 'Not provided' },
    {
      key: 'published_at',
      label: 'Published',
      render: (article) => formatDate(article.published_at),
    },
    {
      key: 'event',
      label: 'Event',
      render: (article) =>
        article.event_id ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenEvent(article.event_id)}
            aria-label={`Open event ${article.event_id} for ${article.title}`}
          >
            Event {article.event_id}
          </button>
        ) : (
          'Not provided'
        ),
    },
  ]

  return (
    <>
      {backButton}

      <Card title={story.title} subtitle={`Story ${story.id}`}>
        <dl className="details-list">
          <div>
            <dt>Created</dt>
            <dd>{formatDate(story.created_at)}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{story.event_count}</dd>
          </div>
          <div>
            <dt>Articles</dt>
            <dd>{story.article_count}</dd>
          </div>
          <div className="details-list-wide">
            <dt>Sources</dt>
            <dd>{sourceNames.length > 0 ? sourceNames.join(', ') : 'No sources yet'}</dd>
          </div>
        </dl>
        <p className="ingestion-note">The backend does not store a description for stories.</p>
      </Card>

      <div className="stories-section">
        <Card title="Events in this story" subtitle="Earliest first">
          {events.length > 0 ? (
            <DataTable columns={eventColumns} rows={events} caption="Events in this story" />
          ) : (
            <EmptyState title="No events yet" description="This story has no events." />
          )}
        </Card>
      </div>

      <div className="stories-section">
        <Card title="Articles in this story" subtitle="From all of its events">
          {story.articles.length > 0 ? (
            <DataTable
              columns={articleColumns}
              rows={story.articles}
              caption="Articles in this story"
            />
          ) : (
            <EmptyState
              title="No articles yet"
              description="No article has been put into this story."
            />
          )}
        </Card>
      </div>
    </>
  )
}

export default StoryDetails
