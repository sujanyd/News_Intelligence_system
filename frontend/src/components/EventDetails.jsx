import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import ArticleDetails from './ArticleDetails'
import ContentAvailabilityBadge from './ContentAvailabilityBadge'
import { PrecisionBadge, TimeAgreementBadge } from './EventTimeInfo'
import { fetchEvent } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { formatEventTime } from '../utils/formatEventTime'

/**
 * EventDetails Component
 *
 * Loads one event from GET /events/{id} and shows:
 *   1. When it happened, how precise that time is, and whether sources disagree
 *   2. The story it belongs to (with a button back to that story)
 *   3. The articles that report it. "View" opens the full article above.
 *
 * Events have no title in the backend, so the page calls it "Event 12"
 * and the article headlines say what happened.
 *
 * @param {Object} props
 * @param {number} props.eventId - Which event to load
 * @param {(storyId: number) => void} props.onOpenStory - Go to the event's story
 * @param {() => void} props.onBackToStories - Go to the stories list
 */
export function EventDetails({ eventId, onOpenStory, onBackToStories }) {
  const [event, setEvent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [selectedArticleId, setSelectedArticleId] = useState(null)

  useEffect(() => {
    let isCurrentRequest = true
    fetchEvent(eventId)
      .then((loadedEvent) => {
        if (isCurrentRequest) setEvent(loadedEvent)
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
  }, [eventId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  function handleViewArticle(article) {
    setSelectedArticleId(article.id)
    window.scrollTo(0, 0) // the article opens at the top of the page
  }

  // "← Back to story" only once we know which story the event is in
  const navigation = (
    <div className="story-nav">
      <button type="button" className="btn btn-secondary story-back" onClick={onBackToStories}>
        ← All stories
      </button>
      {event && event.story_id !== null && (
        <button
          type="button"
          className="btn btn-secondary story-back"
          onClick={() => onOpenStory(event.story_id)}
        >
          ← Back to story
        </button>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <>
        {navigation}
        <LoadingState message="Loading event..." />
      </>
    )
  }

  if (errorMessage) {
    return (
      <>
        {navigation}
        <AlertMessage
          type="error"
          title="Could not load this event."
          message={errorMessage}
          onRetry={handleRetry}
        />
      </>
    )
  }

  const selectedArticle = event.articles.find((article) => article.id === selectedArticleId)

  const articleColumns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source', label: 'Source', render: (article) => article.source_name || 'Not provided' },
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

  return (
    <>
      {navigation}

      {selectedArticleId !== null && (
        <ArticleDetails
          articleId={selectedArticleId}
          sourceName={selectedArticle ? selectedArticle.source_name || undefined : undefined}
          onClose={() => setSelectedArticleId(null)}
        />
      )}

      <Card
        title={`Event ${event.id}`}
        subtitle={event.story_title ? `Part of the story "${event.story_title}"` : 'Story not provided'}
      >
        <dl className="details-list">
          <div>
            <dt>When it happened</dt>
            <dd>{formatEventTime(event)}</dd>
          </div>
          <div>
            <dt>Time precision</dt>
            <dd>
              <PrecisionBadge precision={event.event_time_precision} />
            </dd>
          </div>
          <div>
            <dt>Sources on the time</dt>
            <dd>
              <TimeAgreementBadge disagreement={event.event_time_disagreement} />
            </dd>
          </div>
          <div>
            <dt>Articles</dt>
            <dd>{event.article_count}</dd>
          </div>
        </dl>
        <p className="ingestion-note">
          The backend does not store a title or description for events. The headlines below
          describe what happened.
        </p>
      </Card>

      <div className="stories-section">
        <Card title="Articles reporting this event" subtitle="Press View to read one">
          {event.articles.length > 0 ? (
            <DataTable
              columns={articleColumns}
              rows={event.articles}
              caption="Articles reporting this event"
            />
          ) : (
            <EmptyState
              title="No articles yet"
              description="No article has been linked to this event."
            />
          )}
        </Card>
      </div>
    </>
  )
}

export default EventDetails
