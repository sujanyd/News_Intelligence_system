import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Dashboard from '../pages/Dashboard'
import { fetchArticles, fetchSources, runNewsCollection } from '../api/newsApi'
import { resetMockData } from '../mocks/mockApi'

// The backend has no news collection endpoint yet, so in these tests we
// pretend it exists (INGESTION_AVAILABLE = true) and replace runNewsCollection
// with a fake one. Articles and sources come from the pretend backend.
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

  it('disables the button while collecting, then shows the result and reloads the articles', async () => {
    const pendingRun = createPendingPromise()
    runNewsCollection.mockReturnValueOnce(pendingRun.promise)
    render(<Dashboard />)
    await screen.findByRole('table', { name: 'Most recent articles' })
    expect(fetchArticles).toHaveBeenCalledTimes(1)

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
      ],
      errors: ['Metro Times: feed timed out'],
    })

    expect(await screen.findByText('News collection finished.')).toBeDefined()
    expect(screen.getByText('Feeds attempted')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('Feed errors (1)')).toBeDefined()
    expect(screen.getByText('Metro Times: feed timed out')).toBeDefined()
    // Counts the backend did not send are not shown
    expect(screen.queryByText('Duplicate articles skipped')).toBeNull()

    // The article list is loaded again
    await screen.findByRole('table', { name: 'Most recent articles' })
    expect(fetchArticles).toHaveBeenCalledTimes(2)
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
