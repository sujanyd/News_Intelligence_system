import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Articles from '../pages/Articles'
import { fetchArticles, fetchSources, runNewsCollection } from '../api/newsApi'
import { resetMockData } from '../mocks/mockApi'

// The page uses the pretend backend (mock mode is on in tests).
// Single tests can replace these functions, for example to pretend the server is down.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    fetchArticles: vi.fn(realModule.fetchArticles),
    fetchSources: vi.fn(realModule.fetchSources),
    runNewsCollection: vi.fn(),
  }
})

// Helper: type into the search box
function search(text) {
  fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: text } })
}

const FIRST_TITLE = 'City council approves new budget for public transport'

describe('Articles page', () => {
  beforeEach(() => {
    resetMockData()
    vi.clearAllMocks()
  })

  it('shows a loading message first, then the articles table', async () => {
    render(<Articles />)
    expect(screen.getByText('Loading articles...')).toBeDefined()

    expect(await screen.findByText(FIRST_TITLE)).toBeDefined()
    expect(screen.queryByText('Loading articles...')).toBeNull()
  })

  it('asks the API for one page (limit and offset)', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    // 5 per page, plus 1 extra to find out if there is a next page
    expect(fetchArticles).toHaveBeenCalledWith({ limit: 6, offset: 0, sourceId: undefined })
  })

  it('shows title, source name, published time and content availability', async () => {
    render(<Articles />)
    const table = await screen.findByRole('table', { name: 'List of articles' })

    // source_name and content_availability come from the backend's article list
    expect(within(table).getAllByText('Daily Ledger').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Full text').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Headline only').length).toBeGreaterThan(0)
  })

  it('shows "Not provided" when the backend sends no availability', async () => {
    fetchArticles.mockResolvedValueOnce({
      articles: [{ id: 1, title: 'Plain article', source_id: 1, source_name: 'Daily Ledger', content_availability: null }],
      total: null,
    })
    render(<Articles />)

    expect(await screen.findByText('Not provided')).toBeDefined()
  })

  it('clearly says it is showing mock data', async () => {
    render(<Articles />)
    expect(screen.getByText('Mock data')).toBeDefined()
    await screen.findByRole('table')
  })

  it('loads the next page from the API', async () => {
    render(<Articles />)
    await screen.findByRole('table')
    expect(screen.getAllByRole('button', { name: /View details/ }).length).toBe(5)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(
      await screen.findByText('University announces new scholarship for first-generation students')
    ).toBeDefined()
    expect(fetchArticles).toHaveBeenLastCalledWith({ limit: 6, offset: 5, sourceId: undefined })
    expect(screen.getByText('Page 2')).toBeDefined()
  })

  it('disables "Next" on the last page', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 3')

    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(true)
  })

  it('filters by source using the API', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '3' } })

    const table = await screen.findByRole('table')
    expect(fetchArticles).toHaveBeenLastCalledWith({ limit: 6, offset: 0, sourceId: '3' })
    expect(within(table).getAllByText('Metro Times').length).toBe(2)
    expect(within(table).queryByText('Daily Ledger')).toBeNull()
  })

  it('searches titles across the newest 100 articles, not only this page', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    // "Fuel" articles are on page 3, so they are not on the screen yet
    search('fuel')

    expect(screen.getByText('Searching articles...')).toBeDefined()
    expect(await screen.findByText('Food prices remain steady despite fuel cost increase')).toBeDefined()
    expect(screen.getByText('Fuel costs push up delivery charges, retailers say')).toBeDefined()
    expect(screen.queryByText(FIRST_TITLE)).toBeNull()
    expect(fetchArticles).toHaveBeenLastCalledWith({ limit: 100, offset: 0, sourceId: undefined })
    expect(screen.getByText('Showing 1–2 of 2 matches for "fuel"')).toBeDefined()
    expect(screen.getByText(/backend has no title search yet/)).toBeDefined()
  })

  it('does not send a request for every letter typed', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    search('b')
    await screen.findByText(/matches for "b"/)
    search('bu')
    search('bud')
    search('budget')

    expect(await screen.findByText('Showing 1–2 of 2 matches for "budget"')).toBeDefined()
    // One request for the first page, one when the search started
    expect(fetchArticles).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state when nothing matches, and can clear the search', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    search('zzz')

    expect(await screen.findByText('No articles match "zzz"')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(await screen.findByText(FIRST_TITLE)).toBeDefined()
    expect(screen.getByLabelText('Search by title').value).toBe('')
  })

  it('combines the search with the source filter', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '2' } })
    await screen.findByRole('table')
    search('budget')

    expect(await screen.findByText('Transport budget passes after long council debate')).toBeDefined()
    // The Daily Ledger budget article is filtered out by the backend (source_id=2)
    expect(screen.queryByText(FIRST_TITLE)).toBeNull()
    expect(fetchArticles).toHaveBeenLastCalledWith({ limit: 100, offset: 0, sourceId: '2' })
    expect(screen.getByText(/searches the newest 100 articles from Global Wire/)).toBeDefined()
  })

  it('splits search results into pages without new requests', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    search('e') // matches almost every title
    await screen.findByText(/Showing 1–5 of \d+ matches/)
    const callsBefore = fetchArticles.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText(/Showing 6–10 of \d+ matches/)).toBeDefined()
    expect(screen.getByText(/Page 2 of \d+/)).toBeDefined()
    expect(fetchArticles).toHaveBeenCalledTimes(callsBefore)
  })

  it('goes back to page 1 when the search changes', async () => {
    render(<Articles />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2')

    search('budget')

    expect(await screen.findByText('Showing 1–2 of 2 matches for "budget"')).toBeDefined()
    expect(screen.queryByText(/Page 2/)).toBeNull()
  })

  it('refreshes from the backend and keeps the source filter', async () => {
    render(<Articles />)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '3' } })
    await screen.findByRole('table')
    const callsBefore = fetchArticles.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Refresh articles' }))

    // Loading state, and the button cannot be clicked again meanwhile
    const busyButton = screen.getByRole('button', { name: /Refreshing/ })
    expect(busyButton.disabled).toBe(true)
    fireEvent.click(busyButton)

    await screen.findByRole('table')
    expect(fetchArticles).toHaveBeenCalledTimes(callsBefore + 1)
    expect(fetchArticles).toHaveBeenLastCalledWith({ limit: 6, offset: 0, sourceId: '3' })
    expect(screen.getByLabelText('Source').value).toBe('3')
    expect(screen.getByText(/Last updated/)).toBeDefined()
    // Refreshing only reads articles; it never starts a news collection run
    expect(runNewsCollection).not.toHaveBeenCalled()
  })

  it('keeps the search text when refreshing', async () => {
    render(<Articles />)
    await screen.findByRole('table')
    search('budget')
    await screen.findByText(/matches for "budget"/)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh articles' }))

    expect(await screen.findByText('Showing 1–2 of 2 matches for "budget"')).toBeDefined()
    expect(screen.getByLabelText('Search by title').value).toBe('budget')
  })

  it('shows an error when refreshing fails, and Try again works', async () => {
    render(<Articles />)
    await screen.findByRole('table')
    fetchArticles.mockRejectedValueOnce(new Error('The backend took too long to respond. Please try again.'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh articles' }))

    expect(await screen.findByText('Could not load articles.')).toBeDefined()
    expect(screen.getByText(/took too long/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(FIRST_TITLE)).toBeDefined()
  })

  it('never shows the same article twice', async () => {
    const article = { id: 7, title: 'Repeated article', source_id: 1, source_name: 'Daily Ledger', content_availability: 'full_text' }
    fetchArticles.mockResolvedValueOnce({ articles: [article, article], total: null })
    render(<Articles />)

    expect(await screen.findByText('Repeated article')).toBeDefined()
    expect(screen.getAllByText('Repeated article').length).toBe(1)
  })

  it('loads and shows an article when "View" is clicked', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('button', { name: `View details for ${FIRST_TITLE}` }))

    const details = screen.getByRole('region', { name: 'Article details' })
    expect(within(details).getByText('Loading article...')).toBeDefined()
    expect(await within(details).findByText(/The city council voted on Monday/)).toBeDefined()

    fireEvent.click(within(details).getByRole('button', { name: /Back to articles/i }))
    expect(screen.queryByRole('region', { name: 'Article details' })).toBeNull()
  })

  it('shows an empty state when there are no articles', async () => {
    fetchArticles.mockResolvedValueOnce({ articles: [], total: null })
    render(<Articles />)

    expect(await screen.findByText('No articles collected yet')).toBeDefined()
  })

  it('shows the error from the API and can try again', async () => {
    fetchArticles.mockRejectedValueOnce(new Error('Could not reach the backend at http://backend.test.'))
    render(<Articles />)

    expect(await screen.findByText(/Could not reach the backend/)).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.queryByRole('table')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(FIRST_TITLE)).toBeDefined()
  })

  it('still shows articles when the sources cannot be loaded', async () => {
    fetchSources.mockRejectedValueOnce(new Error('Sources route missing'))
    render(<Articles />)

    expect(await screen.findByText(FIRST_TITLE)).toBeDefined()
    expect(screen.getByText('Source filter unavailable: Sources route missing')).toBeDefined()
    expect(screen.getByLabelText('Source').disabled).toBe(true)
    // The names still show, because the article list includes source_name
    expect(screen.getAllByText('Daily Ledger').length).toBeGreaterThan(0)
  })

  it('shows the source id when there is no source name anywhere', async () => {
    fetchSources.mockRejectedValueOnce(new Error('Sources route missing'))
    fetchArticles.mockResolvedValueOnce({
      articles: [{ id: 1, title: 'No name article', source_id: 4, source_name: null, content_availability: 'full_text' }],
      total: null,
    })
    render(<Articles />)

    expect(await screen.findByText('Source #4')).toBeDefined()
  })
})
