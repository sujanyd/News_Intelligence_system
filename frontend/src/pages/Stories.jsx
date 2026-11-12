import React, { useState } from 'react'
import PageHeader from '../components/PageHeader'
import AlertMessage from '../components/AlertMessage'
import StoryList from '../components/StoryList'
import StoryDetails from '../components/StoryDetails'
import EventDetails from '../components/EventDetails'
import { STORIES_AVAILABLE } from '../api/newsApi'

/**
 * Stories Page
 *
 * A story is one news topic. An event is one thing that happened inside a
 * story. Each article belongs to one event.
 *
 * This page has three views and remembers which one is open:
 *   { name: 'list' }                  -> all stories
 *   { name: 'story', storyId: 4 }     -> one story with its events and articles
 *   { name: 'event', eventId: 12 }    -> one event with its articles
 *
 * @param {Object} props
 * @param {{ name: string, storyId?: number, eventId?: number } | null} [props.initialView]
 *   the view to open first (for example an article's event)
 *
 * Stories only come from the real backend. In mock mode the page says so
 * instead of showing made-up stories.
 */
export function Stories({ initialView = null }) {
  // Another page can open a story or an event directly (see navigation.js)
  const [view, setView] = useState(initialView || { name: 'list' })

  // Change the view and jump to the top, where the new view starts
  function goTo(newView) {
    setView(newView)
    window.scrollTo(0, 0)
  }

  const showList = () => goTo({ name: 'list' })
  const showStory = (storyId) => goTo({ name: 'story', storyId })
  const showEvent = (eventId) => goTo({ name: 'event', eventId })

  function renderView() {
    if (!STORIES_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Stories need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There are no sample stories, so nothing made up is ever shown."
        />
      )
    }
    if (view.name === 'story') {
      return (
        <StoryDetails
          key={view.storyId}
          storyId={view.storyId}
          onBack={showList}
          onOpenEvent={showEvent}
        />
      )
    }
    if (view.name === 'event') {
      return (
        <EventDetails
          key={view.eventId}
          eventId={view.eventId}
          onOpenStory={showStory}
          onBackToStories={showList}
        />
      )
    }
    return <StoryList onOpenStory={showStory} />
  }

  return (
    <div className="page-stories" data-testid="page-stories">
      <PageHeader
        title="Stories"
        description="News topics, the events inside them, and the articles that report each event."
      />
      {renderView()}
    </div>
  )
}

export default Stories
