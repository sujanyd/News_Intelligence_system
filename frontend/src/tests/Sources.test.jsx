import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Sources from '../pages/Sources'
import { fetchSources, resetMockData } from '../api/newsApi'

// Keep the real API functions, but let single tests replace fetchSources
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return { ...realModule, fetchSources: vi.fn(realModule.fetchSources) }
})

// Helper: type into the two form fields and click "Add source"
function fillAndSubmitForm(name, baseUrl) {
  fireEvent.change(screen.getByLabelText(/Source name/), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/Base URL/), { target: { value: baseUrl } })
  fireEvent.click(screen.getByRole('button', { name: 'Add source' }))
}

describe('Sources page', () => {
  beforeEach(() => {
    resetMockData()
  })

  it('shows loading first, then each source name and base URL', async () => {
    render(<Sources />)
    expect(screen.getByText('Loading sources...')).toBeDefined()

    const table = await screen.findByRole('table', { name: 'List of news sources' })
    expect(within(table).getByText('Daily Ledger')).toBeDefined()
    expect(within(table).getByText('https://dailyledger.example')).toBeDefined()
    expect(screen.getByText('5 sources')).toBeDefined()
  })

  it('shows errors when required fields are empty', async () => {
    render(<Sources />)
    await screen.findByRole('table')

    fillAndSubmitForm('', '')

    expect(screen.getByText('Source name is required.')).toBeDefined()
    expect(screen.getByText('Base URL is required.')).toBeDefined()
  })

  it('shows an error when the base URL does not start with http', async () => {
    render(<Sources />)
    await screen.findByRole('table')

    fillAndSubmitForm('Valley News', 'valleynews.example')

    expect(screen.getByText('Base URL must start with http:// or https://')).toBeDefined()
  })

  it('adds a valid source, shows success and clears the form', async () => {
    render(<Sources />)
    await screen.findByRole('table')

    fillAndSubmitForm('Valley News', 'https://valleynews.example')

    expect(await screen.findByText('"Valley News" was added.')).toBeDefined()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Valley News')).toBeDefined()
    expect(screen.getByText('6 sources')).toBeDefined()
    expect(screen.getByLabelText(/Source name/).value).toBe('')
  })

  it('shows an error when the source name already exists', async () => {
    render(<Sources />)
    await screen.findByRole('table')

    fillAndSubmitForm('Daily Ledger', 'https://another.example')

    expect(await screen.findByText('A source with this name already exists.')).toBeDefined()
  })

  it('shows an empty state when there are no sources', async () => {
    fetchSources.mockResolvedValueOnce([])
    render(<Sources />)

    expect(await screen.findByText('No news sources configured yet')).toBeDefined()
  })

  it('shows an error message when sources cannot be loaded', async () => {
    fetchSources.mockRejectedValueOnce(new Error('Server is not responding'))
    render(<Sources />)

    expect(await screen.findByText('Server is not responding')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })
})
