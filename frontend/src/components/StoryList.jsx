import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import Pagination from './Pagination'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { fetchStories, fetchStory, groupArticlesIntoStories } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { getUniqueSourceNames } from '../utils/formatEventTime'

// How many stories to show on one page of the table
export const STORIES_PER_PAGE = 10

// "1 story", "2 stories", ...
function countText(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`
}

// The sentence shown after "Group articles" finished
function describeGrouping(summary) {
  if (summary.articlesGrouped === 0) {
    return 'Every article is already in a story. There was nothing to group.'
  }
  return (
    `Grouped ${countText(summary.articlesGrouped, 'article', 'articles')}: ` +
    `${countText(summary.storiesCreated, 'new story', 'new stories')}, ` +
    `${summary.storiesReused} added to existing stories, ` +
    `${countText(summary.eventsCreated, 'new event', 'new events')}.`
  )
}

/**
 * StoryList Component
 *
 * 1. A "Group articles" button. News collection does NOT put articles into
 *    stories, so this calls POST /stories/group/batch to do it.
 * 2. The stories table, from GET /stories?skip=&limit= (newest first).
 *
 * The stories list from the backend has no source names. So, after a page
 * loads, this asks for each story on the page (GET /stories/{id}) and lists
 * the sources of its articles. If that fails, the row says "Not available".
 *
 * @param {Object} props
 * @param {(storyId: number) => void} props.onOpenStory - Called by a row's "Open" button
 */
export function StoryList({ onOpenStory }) {
  const [stories, setStories] = useState([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  // Source names for each story on this page: { [storyId]: ['BBC', ...] or null }
  // null means "could not load"; a missing key means "still loading"
  const [sourcesByStory, setSourcesByStory] = useState({})

  // "Group articles" button
  const [isGrouping, setIsGrouping] = useState(false)
  const [groupingMessage, setGroupingMessage] = useState('')
  const [groupingError, setGroupingError] = useState('')

  // Load one page of stories, then the sources of each story on it
  useEffect(() => {
    let isCurrentRequest = true

    fetchStories({
      // Ask for one extra story: if it comes back, there is a next page
      limit: STORIES_PER_PAGE + 1,
      skip: (currentPage - 1) * STORIES_PER_PAGE,
    })
      .then((storyList) => {
        if (!isCurrentRequest) return
        const pageStories = storyList.slice(0, STORIES_PER_PAGE)
        setStories(pageStories)
        setHasNextPage(storyList.length > STORIES_PER_PAGE)
        setSourcesByStory({})

        // One request per story; each row fills in when its answer arrives
        for (const story of pageStories) {
          fetchStory(story.id)
            .then((details) => getUniqueSourceNames(details.articles))
            .catch(() => null)
            .then((names) => {
              if (isCurrentRequest) {
                setSourcesByStory((previous) => ({ ...previous, [story.id]: names }))
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
  }, [currentPage, reloadCount])

  function reloadFromFirstPage() {
    setIsLoading(true)
    setErrorMessage('')
    setCurrentPage(1)
    setReloadCount(reloadCount + 1)
  }

  function handlePageChange(newPage) {
    setIsLoading(true)
    setErrorMessage('')
    setCurrentPage(newPage)
  }

  async function handleGroupArticles() {
    if (isGrouping) return // already running
    setIsGrouping(true)
    setGroupingMessage('')
    setGroupingError('')
    try {
      const summary = await groupArticlesIntoStories()
      setGroupingMessage(describeGrouping(summary))
      reloadFromFirstPage() // show the new stories
    } catch (error) {
      setGroupingError(error.message)
    } finally {
      setIsGrouping(false)
    }
  }

  function renderSources(story) {
    if (story.article_count === 0) return 'No articles yet'
    if (!(story.id in sourcesByStory)) return 'Loading...'
    const names = sourcesByStory[story.id]
    if (names === null) return 'Not available'
    return names.length > 0 ? names.join(', ') : 'Not provided'
  }

  const columns = [
    { key: 'title', label: 'Story', render: (story) => <strong>{story.title}</strong> },
    { key: 'event_count', label: 'Events' },
    { key: 'article_count', label: 'Articles' },
    { key: 'sources', label: 'Sources', render: renderSources },
    { key: 'created_at', label: 'Created', render: (story) => formatDate(story.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      render: (story) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpenStory(story.id)}
          aria-label={`Open story ${story.title}`}
        >
          Open
        </button>
      ),
    },
  ]

  function renderStoryTable() {
    if (isLoading) {
      return <LoadingState message="Loading stories..." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load stories."
          message={errorMessage}
          onRetry={reloadFromFirstPage}
        />
      )
    }
    const pagination = (
      <Pagination
        currentPage={currentPage}
        hasNextPage={hasNextPage}
        onPageChange={handlePageChange}
      />
    )
    if (stories.length === 0) {
      return (
        <>
          <EmptyState
            title={currentPage > 1 ? 'No more stories' : 'No stories yet'}
            description={
              currentPage > 1
                ? 'There are no stories on this page. Go back to the previous page.'
                : 'Collect news on the Dashboard, then press "Group articles" above to sort the articles into stories.'
            }
          />
          {pagination}
        </>
      )
    }
    return (
      <>
        <DataTable columns={columns} rows={stories} caption="List of stories" />
        {pagination}
      </>
    )
  }

  return (
    <>
      <Card
        title="Group articles into stories"
        subtitle="Puts new articles into stories and events, up to 200 at a time"
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGroupArticles}
          disabled={isGrouping}
          aria-busy={isGrouping}
        >
          {isGrouping ? (
            <span className="loading-spinner-wrap">
              <span className="spinner" aria-hidden="true" /> Grouping articles...
            </span>
          ) : (
            'Group articles'
          )}
        </button>
        {groupingMessage && <AlertMessage type="success" message={groupingMessage} />}
        {groupingError && (
          <AlertMessage type="error" title="Grouping failed." message={groupingError} />
        )}
      </Card>

      <div className="stories-section">
        <Card title="All stories" subtitle="Newest first">
          {renderStoryTable()}
        </Card>
      </div>
    </>
  )
}

export default StoryList
