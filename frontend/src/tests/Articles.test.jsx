import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Articles from '../pages/Articles'
import { fetchArticles, resetMockData } from '../api/newsApi'

// Keep the real API functions, but let single tests replace fetchArticles
// (for example to pretend the server is down)
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return { ...realModule, fetchArticles: vi.fn(realModule.fetchArticles) }
})

describe('Articles page', () => {
  beforeEach(() => {
    resetMockData()
  })

  it('shows a loading message first, then the articles table', async () => {
    render(<Articles />)
    expect(screen.getByText('Loading articles...')).toBeDefined()

    expect(
      await screen.findByText('City council approves new budget for public transport')
    ).toBeDefined()
    expect(screen.queryByText('Loading articles...')).toBeNull()
  })

  it('shows title, source, published time and content availability', async () => {
    render(<Articles />)
    await screen.findByText('City council approves new budget for public transport')

    const table = screen.getByRole('table', { name: 'List of articles' })
    expect(within(table).getByText('Title')).toBeDefined()
    expect(within(table).getByText('Source')).toBeDefined()
    expect(within(table).getByText('Published')).toBeDefined()
    expect(within(table).getByText('Content')).toBeDefined()
    expect(within(table).getAllByText('Available').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Missing').length).toBeGreaterThan(0)
  })

  it('clearly says it is showing mock data', async () => {
    render(<Articles />)
    expect(screen.getByText('Mock data')).toBeDefined()
    await screen.findByRole('table')
  })

  it('shows 5 articles per page and moves to the next page', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    expect(screen.getByText('Page 1 of 3')).toBeDefined()
    expect(screen.getAllByRole('button', { name: /View details/ }).length).toBe(5)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 3')).toBeDefined()
    expect(screen.getByText('University announces new scholarship for first-generation students')).toBeDefined()
  })

  it('filters articles by the search text', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: 'storm' } })

    expect(screen.getByText('Fishing communities prepare for weekend storm')).toBeDefined()
    expect(screen.queryByText('City council approves new budget for public transport')).toBeNull()
    expect(screen.getByText('Showing 1 of 1 articles')).toBeDefined()
  })

  it('filters articles by source', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '3' } })

    const table = screen.getByRole('table')
    const sourceCells = within(table).getAllByText('Metro Times')
    expect(sourceCells.length).toBe(2)
    expect(within(table).queryByText('Daily Ledger')).toBeNull()
  })

  it('shows a "no match" message and can clear the filters', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: 'zzz' } })
    expect(screen.getByText('No articles match your filters')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Page 1 of 3')).toBeDefined()
  })

  it('shows the details of an article when "View" is clicked', async () => {
    render(<Articles />)
    await screen.findByRole('table')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'View details for City council approves new budget for public transport',
      })
    )

    const details = screen.getByRole('region', { name: 'Article details' })
    expect(within(details).getByText(/The city council voted on Monday/)).toBeDefined()

    fireEvent.click(within(details).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Article details' })).toBeNull()
  })

  it('shows an empty state when there are no articles', async () => {
    fetchArticles.mockResolvedValueOnce([])
    render(<Articles />)

    expect(await screen.findByText('No articles collected yet')).toBeDefined()
  })

  it('shows an error message and can try again', async () => {
    fetchArticles.mockRejectedValueOnce(new Error('Server is not responding'))
    render(<Articles />)

    expect(await screen.findByText('Server is not responding')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()

    // The second call uses the normal mock data again
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByText('City council approves new budget for public transport')
    ).toBeDefined()
  })
})
