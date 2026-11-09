import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Reports from '../pages/Reports'
import StoryComparison from '../components/StoryComparison'
import RssFeedList from '../components/RssFeedList'
import {
  fetchAllStories,
  fetchArticleAnalyses,
  fetchIngestionFeeds,
  fetchPoliticalAnalysis,
  fetchStory,
} from '../api/newsApi'
import { ApiError } from '../api/client'

// Tests run in mock mode, where these features are turned off. Here we turn
// them on and replace the backend calls with fakes.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    STORIES_AVAILABLE: true,
    POLITICAL_AVAILABLE: true,
    INGESTION_AVAILABLE: true,
    fetchAllStories: vi.fn(),
    fetchStory: vi.fn(),
    fetchArticleAnalyses: vi.fn(),
    fetchPoliticalAnalysis: vi.fn(),
    fetchIngestionFeeds: vi.fn(),
  }
})

// Test data only, shaped like the normalized backend replies
const STORY_LIST = [
  { id: 10, title: "Iran's chief negotiator says Americans voted 'no to war'", article_count: 3, event_count: 1, created_at: '2026-11-09T10:00:00' },
  { id: 20, title: 'Single article story', article_count: 1, event_count: 1, created_at: '2026-11-09T10:00:00' },
]

const ARTICLES = [
  { id: 1, source_name: 'BBC News', title: 'Iran says US voters rejected war', published_at: '2026-11-05T10:00:00', url: 'https://bbc.test/1', content_availability: 'summary_only' },
  { id: 2, source_name: 'BBC News', title: 'Second BBC article', published_at: '2026-11-05T12:00:00', url: '', content_availability: 'headline_only' },
  { id: 3, source_name: 'NPR News', title: 'Tehran reacts to midterms', published_at: '2026-11-06T09:00:00', url: '', content_availability: 'summary_only' },
]

const STORY = {
  id: 10,
  title: STORY_LIST[0].title,
  events: [{ id: 5, event_time: '2026-11-05T00:00:00', event_time_precision: 'date', event_time_disagreement: false, article_count: 3 }],
  articles: ARTICLES,
}

function analyses({ entities, frames = [], signals = [], facts = [], tone = 'neutral' }) {
  return {
    insights: { entities, topics: [{ id: 1, name: 'Midterms' }], facts, quotes: [] },
    tone: {
      tone: { label: tone, score: tone === 'critical' ? -0.6 : 0, confidence: 0.8, explanation: null },
      headline_framing: { frames, evidence_phrases: frames.length ? ['war'] : [], primary_frame: frames[0] || null },
      signals,
    },
    political: { entities: [], signals: [] },
    errors: {},
  }
}

const ANALYSES = {
  1: analyses({
    entities: [{ id: 1, name: 'Iran', type: 'LOCATION' }, { id: 2, name: 'Oman', type: 'LOCATION' }],
    frames: ['conflict_emphasis'],
    signals: [{ id: 7, frame_type: 'conflict_emphasis', evidence_text: 'Iran said voters said no to war.', from_headline: false }],
    facts: [{ id: 1, statement: 'Iran commented on the vote.' }],
    tone: 'critical',
  }),
  2: { insights: null, tone: null, political: null, errors: { insights: 'boom', tone: 'boom', political: 'boom' } },
  3: analyses({ entities: [{ id: 3, name: 'iran', type: 'LOCATION' }], facts: [] }),
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchAllStories.mockResolvedValue({ items: STORY_LIST, isComplete: true })
  fetchStory.mockResolvedValue(STORY)
  fetchArticleAnalyses.mockImplementation(async (id) => ANALYSES[id])
  fetchPoliticalAnalysis.mockResolvedValue({ article_id: null, analyzed_at: null, entities: [], signals: [] })
})

describe('Reports page', () => {
  it('lists stories with 2 or more articles, and all of them on request', async () => {
    render(<Reports />)
    const table = await screen.findByRole('table', { name: 'Stories with a report' })
    expect(within(table).getByText(STORY_LIST[0].title)).toBeDefined()
    expect(within(table).queryByText('Single article story')).toBeNull()

    fireEvent.click(screen.getByLabelText('Also show stories with only one article'))
    expect(within(screen.getByRole('table', { name: 'Stories with a report' })).getByText('Single article story')).toBeDefined()
  })

  it('opens a report with summary, publishers, coverage, framing, gaps, evidence and limitations', async () => {
    render(<Reports />)
    fireEvent.click(await screen.findByRole('button', { name: `Open the report for ${STORY_LIST[0].title}` }))

    const report = await screen.findByTestId('story-report')
    expect(fetchStory).toHaveBeenCalledWith(10)
    expect(fetchArticleAnalyses).toHaveBeenCalledTimes(3)

    expect(within(screen.getByRole('list', { name: 'Publishers' })).getByText('BBC News')).toBeDefined()
    expect(within(report).getByRole('table', { name: 'Coverage by article' })).toBeDefined()

    const frames = screen.getByRole('list', { name: 'Framing types used' })
    expect(within(frames).getByText('Conflict')).toBeDefined()
    expect(within(frames).getByText('1 of 3 articles (BBC News)')).toBeDefined()

    // Iran is named by both articles whose insights loaded; Oman only by BBC
    expect(screen.getByText('Iran (Location)')).toBeDefined()
    expect(screen.getByText('Oman (Location): BBC News')).toBeDefined()

    expect(screen.getByText('“Iran said voters said no to war.”')).toBeDefined()

    const limits = screen.getByTestId('report-limitations')
    expect(within(limits).getByText(/Tone is not bias/)).toBeDefined()
    expect(within(limits).getByText(/1 article has only a/)).toBeDefined()
    expect(within(limits).getByText(/Some analyses of "Second BBC article" could not be loaded/)).toBeDefined()
    // No download: the backend has no export
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
  })

  it('goes back to the list', async () => {
    render(<Reports />)
    fireEvent.click(await screen.findByRole('button', { name: `Open the report for ${STORY_LIST[0].title}` }))
    await screen.findByTestId('story-report')
    fireEvent.click(screen.getByRole('button', { name: '← All reports' }))
    expect(await screen.findByRole('table', { name: 'Stories with a report' })).toBeDefined()
  })

  it('shows the error with "Try again"', async () => {
    fetchAllStories.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<Reports />)
    expect(await screen.findByText('Could not load the stories.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Stories with a report' })).toBeDefined()
  })

  it('says when a report could not be built', async () => {
    fetchStory.mockRejectedValueOnce(new ApiError('Story with ID 10 not found. (HTTP 404)', 404))
    render(<Reports />)
    fireEvent.click(await screen.findByRole('button', { name: `Open the report for ${STORY_LIST[0].title}` }))
    expect(await screen.findByText('Could not build the report.')).toBeDefined()
  })
})

describe('StoryComparison', () => {
  it('offers only stories with 2 or more articles', async () => {
    render(<StoryComparison />)
    const picker = await screen.findByLabelText('Story')
    const options = within(picker).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Choose a story...', `${STORY_LIST[0].title} (3 articles)`])
  })

  it('compares two publishers: headlines, framing, shared and missing names, facts', async () => {
    render(<StoryComparison />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })

    // Article A = first article, Article B = first article from another publisher
    expect((await screen.findByLabelText('Article A')).value).toBe('1')
    expect(screen.getByLabelText('Article B').value).toBe('3')

    expect(await screen.findByText('Headlines and framing')).toBeDefined()
    expect(fetchArticleAnalyses).toHaveBeenCalledWith('1')
    expect(fetchArticleAnalyses).toHaveBeenCalledWith('3')
    expect(screen.getByText('matched: “war”')).toBeDefined()

    const shared = screen.getAllByText('Named in both')[0].nextSibling
    expect(shared.textContent).toBe('Iran (Location)')
    // Once for people/places, once for topics
    expect(screen.getAllByText('Only in BBC News (Article A)', { selector: 'dt' })).toHaveLength(2)
    expect(screen.getByText('Oman (Location)')).toBeDefined()

    expect(screen.getByText('“Iran commented on the vote.”')).toBeDefined()
    expect(screen.getByText(/The system does not check whether/)).toBeDefined()
  })

  it('says when both articles come from one publisher', async () => {
    render(<StoryComparison />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })
    await screen.findByText('Headlines and framing')
    fireEvent.change(screen.getByLabelText('Article B'), { target: { value: '2' } })
    expect(await screen.findByText(/Both articles are from BBC News/)).toBeDefined()
  })

  it('shows the error with "Try again" when stories cannot load', async () => {
    fetchAllStories.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<StoryComparison />)
    expect(await screen.findByText('Could not load stories.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Story')).toBeDefined()
  })
})

describe('RssFeedList', () => {
  it('shows the feeds the news collection reads', async () => {
    fetchIngestionFeeds.mockResolvedValue([
      { source_name: 'NPR News', base_url: 'https://npr.org', feed_url: 'https://feeds.npr.org/1001/rss.xml' },
    ])
    render(<RssFeedList />)
    const table = await screen.findByRole('table', { name: 'RSS feeds read by News Collection' })
    expect(within(table).getByText('NPR News')).toBeDefined()
    expect(within(table).getByText('https://feeds.npr.org/1001/rss.xml')).toBeDefined()
  })

  it('shows the error with "Try again"', async () => {
    fetchIngestionFeeds.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    fetchIngestionFeeds.mockResolvedValueOnce([])
    render(<RssFeedList />)
    expect(await screen.findByText('Could not load the RSS feeds.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No RSS feeds configured')).toBeDefined()
  })
})
