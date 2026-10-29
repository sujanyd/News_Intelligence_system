import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import App from '../App'
import { API_BASE_URL, getApiEndpoint } from '../api/config'

describe('News Bias and Framing Analysis System - Dashboard & Navigation Tests', () => {
  it('renders the application layout and project title in header', () => {
    render(<App />)
    const titleElements = screen.getAllByText(/News Bias and Framing Analysis System/i)
    expect(titleElements.length).toBeGreaterThan(0)
  })

  it('renders all 5 primary navigation items in sidebar', () => {
    const { container } = render(<App />)
    expect(container.querySelector('#nav-dashboard')).toBeDefined()
    expect(container.querySelector('#nav-articles')).toBeDefined()
    expect(container.querySelector('#nav-sources')).toBeDefined()
    expect(container.querySelector('#nav-comparisons')).toBeDefined()
    expect(container.querySelector('#nav-reports')).toBeDefined()
  })

  it('renders the 4 required metric placeholder cards on Dashboard', () => {
    render(<App />)
    expect(screen.getByText('Total articles')).toBeDefined()
    expect(screen.getByText('News sources')).toBeDefined()
    expect(screen.getByText('Stories and events')).toBeDefined()
    expect(screen.getByText('Comparisons completed')).toBeDefined()
  })

  it('renders the recent articles section with articles from the API', async () => {
    render(<App />)
    expect(screen.getByText('Recent Articles')).toBeDefined()
    expect(await screen.findByRole('table', { name: 'Most recent articles' })).toBeDefined()
  })

  it('opens the Articles page from the dashboard "View all articles" button', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'View all articles' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeDefined()
    await screen.findByRole('table', { name: 'List of articles' })
  })

  it('navigates seamlessly across all views when sidebar links are clicked', () => {
    const { container } = render(<App />)

    // Initial page is Dashboard
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()

    // Navigate to Articles
    fireEvent.click(container.querySelector('#nav-articles'))
    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeDefined()

    // Navigate to Sources
    fireEvent.click(container.querySelector('#nav-sources'))
    expect(screen.getByRole('heading', { level: 1, name: 'News Sources' })).toBeDefined()

    // Navigate to Comparisons
    fireEvent.click(container.querySelector('#nav-comparisons'))
    expect(screen.getByRole('heading', { level: 1, name: 'Comparisons' })).toBeDefined()

    // Navigate to Reports
    fireEvent.click(container.querySelector('#nav-reports'))
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeDefined()

    // Navigate back to Dashboard
    fireEvent.click(container.querySelector('#nav-dashboard'))
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })

  it('toggles mobile sidebar drawer when hamburger button is clicked', () => {
    const { container } = render(<App />)
    const toggleBtn = screen.getByLabelText('Toggle navigation menu')
    const sidebar = container.querySelector('.app-sidebar')

    expect(sidebar.classList.contains('mobile-open')).toBe(false)
    fireEvent.click(toggleBtn)
    expect(sidebar.classList.contains('mobile-open')).toBe(true)

    const closeBtn = screen.getByLabelText('Close navigation sidebar')
    fireEvent.click(closeBtn)
    expect(sidebar.classList.contains('mobile-open')).toBe(false)
  })

  it('displays the configured API base URL', () => {
    render(<App />)
    const apiPills = screen.getAllByText(new RegExp(API_BASE_URL, 'i'))
    expect(apiPills.length).toBeGreaterThan(0)
  })

  it('properly formats API endpoints in api/config', () => {
    expect(API_BASE_URL).toBeDefined()
    const endpoint = getApiEndpoint('/api/v1/health')
    expect(endpoint).toBe(`${API_BASE_URL.replace(/\/+$/, '')}/api/v1/health`)
  })
})
