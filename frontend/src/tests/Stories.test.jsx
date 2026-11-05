import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Stories from '../pages/Stories'
import {
  fetchEvent,
  fetchStories,
  fetchStory,
  groupArticlesIntoStories,
} from '../api/newsApi'
import { ApiError } from '../api/client'

// Tests run in mock mode, where stories are turned off (there are no sample
// stories). Here we turn them on and replace the four story calls with fakes,
// so each test decides what the "backend" answers.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    STORIES_AVAILABLE: true,
    fetchStories: vi.fn(),
    fetchStory: vi.fn(),
    fetchEvent: vi.fn(),
    groupArticlesIntoStories: vi.fn(),
  }
})

// Test replies, already in the shape normalize.js gives the pages
function makeArticle(id, sourceName, eventId) {
  return {
    id,
    title: `Headline ${id}`,
    source_id: 1,
    source_name: sourceName,
    event_id: eventId,
    url: `https://news.example/${id}`,
    published_at: '2026-11-04T10:00:00',
    retrieved_at: null,
    content_availability: 'full_text',
    content: null,
  }
}

function makeEvent(id, overrides = {}) {
  return {
    id,
    story_id: 4,
    story_title: null,
    event_time: '2026-11-04T16:00:00',
    event_time_precision: 'exact',
    event_time_disagreement: false,
    article_count: 1,
    articles: [],
    ...overrides,
  }
}

const STORY_LIST = [
  { id: 4, title: 'School attack in Ukraine', created_at: '2026-11-05T10:00:00', event_count: 2, article_count: 3, events: [], articles: [] },
  { id: 5, title: 'US midterm results', created_at: '2026-11-05T09:00:00', event_count: 1, article_count: 1, events: [], articles: [] },
]

const STORY_DETAILS = {
  ...STORY_LIST[0],
  events: [
    makeEvent(12, { event_time: '2026-11-04T16:00:00', article_count: 2 }),
    makeEvent(11, { event_time: '2026-11-03T09:00:00', event_time_precision: 'date', event_time_disagreement: true }),
  ],
  articles: [makeArticle(1, 'The Guardian', 12), makeArticle(2, 'BBC News', 12), makeArticle(3, 'The Guardian', 11)],
}

const EVENT_DETAILS = makeEvent(12, {
  story_title: 'School attack in Ukraine',
  article_count: 2,
  articles: [makeArticle(1, 'The Guardian', 12), makeArticle(2, 'BBC News', 12)],
})

describe('Stories page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchStories.mockResolvedValue(STORY_LIST)
    fetchStory.mockImplementation(async (id) =>
      id === 4 ? STORY_DETAILS : { ...STORY_LIST[1], articles: [makeArticle(9, 'NPR', 20)] }
    )
    fetchEvent.mockResolvedValue(EVENT_DETAILS)
  })

  it('shows loading, then the stories with counts and sources', async () => {
    render(<Stories />)
    expect(screen.getByText('Loading stories...')).toBeDefined()

    const table = await screen.findByRole('table', { name: 'List of stories' })
    expect(fetchStories).toHaveBeenCalledWith({ limit: 11, skip: 0 })
    expect(within(table).getByText('School attack in Ukraine')).toBeDefined()
    expect(within(table).getByText('US midterm results')).toBeDefined()
    // Sources come from each story's details, A to Z, each name once
    expect(await within(table).findByText('BBC News, The Guardian')).toBeDefined()
    expect(await within(table).findByText('NPR')).toBeDefined()
  })

  it('says "Not available" for a story whose sources could not be loaded', async () => {
    fetchStory.mockRejectedValue(new ApiError('Story with ID 4 does not exist. (HTTP 404)', 404))
    render(<Stories />)
    const table = await screen.findByRole('table', { name: 'List of stories' })
    expect((await within(table).findAllByText('Not available')).length).toBe(2)
  })

  it('shows an empty state when there are no stories', async () => {
    fetchStories.mockResolvedValue([])
    render(<Stories />)
    expect(await screen.findByText('No stories yet')).toBeDefined()
  })

  it('shows the error and loads again with "Try again"', async () => {
    fetchStories.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<Stories />)
    expect(await screen.findByText('Could not load stories.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'List of stories' })).toBeDefined()
    expect(fetchStories).toHaveBeenCalledTimes(2)
  })

  it('shows a Next page button when the backend sends more than one page', async () => {
    const elevenStories = Array.from({ length: 11 }, (_, index) => ({
      ...STORY_LIST[1],
      id: 100 + index,
      title: `Story ${index}`,
      article_count: 0,
    }))
    fetchStories.mockResolvedValue(elevenStories)
    render(<Stories />)
    const table = await screen.findByRole('table', { name: 'List of stories' })
    expect(within(table).getAllByRole('row').length).toBe(11) // header + 10 stories

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('table', { name: 'List of stories' })
    expect(fetchStories).toHaveBeenLastCalledWith({ limit: 11, skip: 10 })
  })

  it('opens a story with its details, events (earliest first) and articles', async () => {
    render(<Stories />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open story School attack in Ukraine' }))

    expect(await screen.findByRole('heading', { name: 'School attack in Ukraine' })).toBeDefined()
    expect(screen.getByText('The backend does not store a description for stories.')).toBeDefined()

    const events = screen.getByRole('table', { name: 'Events in this story' })
    const eventRows = within(events).getAllByRole('row').slice(1)
    expect(within(eventRows[0]).getByText('Event 11')).toBeDefined() // 3 Nov comes first
    expect(within(eventRows[0]).getByText('Date only')).toBeDefined()
    expect(within(eventRows[0]).getByText('Sources disagree')).toBeDefined()
    expect(within(eventRows[1]).getByText('Event 12')).toBeDefined()
    expect(within(eventRows[1]).getByText('Exact time')).toBeDefined()

    const articles = screen.getByRole('table', { name: 'Articles in this story' })
    expect(within(articles).getAllByRole('row').length).toBe(4)
  })

  it('opens an event from the story, shows its articles, and goes back', async () => {
    render(<Stories />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open story School attack in Ukraine' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open event 12' }))

    expect(await screen.findByRole('heading', { name: 'Event 12' })).toBeDefined()
    expect(fetchEvent).toHaveBeenCalledWith(12)
    expect(screen.getByText('Part of the story "School attack in Ukraine"')).toBeDefined()
    expect(screen.getByText('Exact time')).toBeDefined()
    expect(screen.getByText('No conflict reported')).toBeDefined()
    const articles = screen.getByRole('table', { name: 'Articles reporting this event' })
    expect(within(articles).getByText('Headline 1')).toBeDefined()
    expect(within(articles).getByText('BBC News')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '← Back to story' }))
    expect(await screen.findByRole('heading', { name: 'School attack in Ukraine' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '← All stories' }))
    expect(await screen.findByRole('table', { name: 'List of stories' })).toBeDefined()
  })

  it('opens an event from the event button of an article', async () => {
    render(<Stories />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open story School attack in Ukraine' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open event 11 for Headline 3' }))
    expect(fetchEvent).toHaveBeenCalledWith(11)
  })

  it('shows an error with "Try again" when an event cannot be loaded', async () => {
    fetchEvent.mockRejectedValueOnce(new ApiError('Event with ID 12 does not exist. (HTTP 404)', 404))
    render(<Stories />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open story School attack in Ukraine' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open event 12' }))

    expect(await screen.findByText('Could not load this event.')).toBeDefined()
    expect(screen.getByText('Event with ID 12 does not exist. (HTTP 404)')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Event 12' })).toBeDefined()
  })

  it('groups articles, shows what happened, and reloads the stories', async () => {
    groupArticlesIntoStories.mockResolvedValue({
      articlesGrouped: 83,
      storiesCreated: 66,
      storiesReused: 17,
      eventsCreated: 83,
      eventsReused: 0,
    })
    render(<Stories />)
    await screen.findByRole('table', { name: 'List of stories' })

    fireEvent.click(screen.getByRole('button', { name: 'Group articles' }))
    expect(screen.getByRole('button', { name: /Grouping articles/ }).disabled).toBe(true)

    expect(
      await screen.findByText(
        'Grouped 83 articles: 66 new stories, 17 added to existing stories, 83 new events.'
      )
    ).toBeDefined()
    expect(fetchStories).toHaveBeenCalledTimes(2)
  })

  it('says when there was nothing to group', async () => {
    groupArticlesIntoStories.mockResolvedValue({
      articlesGrouped: 0,
      storiesCreated: 0,
      storiesReused: 0,
      eventsCreated: 0,
      eventsReused: 0,
    })
    render(<Stories />)
    fireEvent.click(screen.getByRole('button', { name: 'Group articles' }))
    expect(
      await screen.findByText('Every article is already in a story. There was nothing to group.')
    ).toBeDefined()
  })

  it('shows the error when grouping fails', async () => {
    groupArticlesIntoStories.mockRejectedValue(new ApiError('Batch grouping failed: boom (HTTP 500)', 500))
    render(<Stories />)
    fireEvent.click(screen.getByRole('button', { name: 'Group articles' }))
    expect(await screen.findByText('Grouping failed.')).toBeDefined()
    expect(screen.getByText('Batch grouping failed: boom (HTTP 500)')).toBeDefined()
  })
})
