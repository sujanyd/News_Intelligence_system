import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Dashboard from '../pages/Dashboard'
import { fetchArticles, fetchSources, runNewsCollection } from '../api/newsApi'
import { resetMockData } from '../mocks/mockApi'

// Tests run in mock mode, where news collection is turned off. Here we turn it
// on (INGESTION_AVAILABLE = true) and replace runNewsCollection with a fake one,
// so no real RSS feed is ever read. Articles and sources come from the pretend backend.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    INGESTION_AVAILABLE: true,
    fetchArticles: vi.fn(realModule.fetchArticles),
    fetchSources: vi.fn(realModule.fetchSources),
    runNewsCollection: vi.fn(),
  }
})

const NEWEST_TITLE = 'City council approves new budget for public transport'

// A promise we can finish later, to look at the screen while a run is going
function createPendingPromise() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Dashboard', () => {
  beforeEach(() => {
    resetMockData()
    vi.clearAllMocks()
  })

  it('shows loading, then the newest articles with source, date and content', async () => {
    render(<Dashboard />)
    expect(screen.getByText('Loading recent articles...')).toBeDefined()

    const table = await screen.findByRole('table', { name: 'Most recent articles' })
    expect(fetchArticles).toHaveBeenCalledWith({ limit: 5, offset: 0 })
    expect(within(table).getByText(NEWEST_TITLE)).toBeDefined()
    expect(within(table).getAllByText('Daily Ledger').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Full text').length).toBeGreaterThan(0)
    expect(within(table).getAllByRole('button', { name: /View details/ }).length).toBe(5)
  })

  it('opens the article details from the dashboard', async () => {
    render(<Dashboard />)
    await screen.findByRole('table', { name: 'Most recent articles' })

    fireEvent.click(screen.getByRole('button', { name: `View details for ${NEWEST_TITLE}` }))

    const details = screen.getByRole('region', { name: 'Article details' })
    expect(await within(details).findByText(/The city council voted on Monday/)).toBeDefined()
  })

  it('calls onNavigate for "View all articles" and "Manage sources"', async () => {
    const onNavigate = vi.fn()
    render(<Dashboard onNavigate={onNavigate} />)
    await screen.findByRole('table', { name: 'Most recent articles' })

    fireEvent.click(screen.getByRole('button', { name: 'View all articles' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manage sources' }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'articles')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'sources')
  })

  it('shows an empty state when there are no articles', async () => {
    fetchArticles.mockResolvedValueOnce({ articles: [], total: null })
    render(<Dashboard />)

    expect(await screen.findByText('No articles collected yet')).toBeDefined()
  })

  it('shows the API error for articles and can try again', async () => {
    fetchArticles.mockRejectedValueOnce(new Error('Could not reach the backend at http://backend.test.'))
    render(<Dashboard />)

    expect(await screen.findByText('Could not load recent articles.')).toBeDefined()
    expect(screen.getByText(/Could not reach the backend/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(NEWEST_TITLE)).toBeDefined()
  })

  it('lists the sources from the API with their base URL, and counts them', async () => {
    render(<Dashboard />)

    const table = await screen.findByRole('table', { name: 'Configured news sources' })
    expect(within(table).getByText('Daily Ledger')).toBeDefined()
    expect(within(table).getByRole('link', { name: 'https://dailyledger.example' })).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    // No "connected" claim, because the backend does not report it
    expect(screen.getByText(/does not report whether each source/)).toBeDefined()
    expect(screen.queryByText(/Connected/)).toBeNull()
  })

  it('shows an error and no count when sources cannot be loaded', async () => {
    fetchSources.mockRejectedValueOnce(new Error('Sources route missing'))
    render(<Dashboard />)

    expect(await screen.findByText('Could not load sources.')).toBeDefined()
    expect(screen.getByText('Could not load sources')).toBeDefined()
  })

  it('disables the button while collecting, then shows the result and reloads the lists', async () => {
    const pendingRun = createPendingPromise()
    runNewsCollection.mockReturnValueOnce(pendingRun.promise)
    render(<Dashboard />)
    await screen.findByRole('table', { name: 'Most recent articles' })
    await screen.findByRole('table', { name: 'Configured news sources' })
    expect(fetchArticles).toHaveBeenCalledTimes(1)
    expect(fetchSources).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Run News Collection' }))

    const runningButton = screen.getByRole('button', { name: /Collecting news/ })
    expect(runningButton.disabled).toBe(true)
    // A second click while it runs does nothing
    fireEvent.click(runningButton)
    expect(runNewsCollection).toHaveBeenCalledTimes(1)

    pendingRun.resolve({
      counts: [
        { key: 'feeds_attempted', label: 'Feeds attempted', value: 4 },
        { key: 'articles_inserted', label: 'New articles inserted', value: 12 },
        { key: 'feed_errors', label: 'Feed errors', value: 1 },
      ],
      feeds: [
        { id: 0, source_name: 'BBC News', feed_url: 'https://bbc.example/rss', status: 'success',
          articles_inserted: 12, articles_skipped_duplicate: 3, error: null },
        { id: 1, source_name: 'Metro Times', feed_url: 'https://metro.example/rss', status: 'error',
          articles_inserted: 0, articles_skipped_duplicate: 0, error: 'Connection timed out after 10s' },
      ],
    })

    expect(await screen.findByText('News collection finished.')).toBeDefined()
    expect(screen.getByText('Feeds attempted')).toBeDefined()
    expect(screen.getByText('Feed errors')).toBeDefined()
    // Counts the backend did not send are not shown
    expect(screen.queryByText('Duplicate articles skipped')).toBeNull()

    const feedTable = screen.getByRole('table', { name: 'Result for each feed' })
    expect(within(feedTable).getByText('BBC News')).toBeDefined()
    expect(within(feedTable).getByText('Success')).toBeDefined()
    expect(within(feedTable).getByText('Failed')).toBeDefined()
    expect(within(feedTable).getByText('Connection timed out after 10s')).toBeDefined()

    // Both lists are loaded again (a run can add articles and sources)
    await screen.findByRole('table', { name: 'Most recent articles' })
    await screen.findByRole('table', { name: 'Configured news sources' })
    expect(fetchArticles).toHaveBeenCalledTimes(2)
    expect(fetchSources).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Run News Collection' }).disabled).toBe(false)
  })

  it('shows an error when news collection fails, and does not reload articles', async () => {
    runNewsCollection.mockRejectedValueOnce(new Error('Feed service is down (HTTP 503)'))
    render(<Dashboard />)
    await screen.findByRole('table', { name: 'Most recent articles' })

    fireEvent.click(screen.getByRole('button', { name: 'Run News Collection' }))

    expect(await screen.findByText('News collection failed.')).toBeDefined()
    expect(screen.getByText('Feed service is down (HTTP 503)')).toBeDefined()
    expect(fetchArticles).toHaveBeenCalledTimes(1)
  })
})
