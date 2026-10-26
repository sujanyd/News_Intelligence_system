import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import App from '../App'
import { API_BASE_URL, getApiEndpoint } from '../api/config'

describe('News Bias and Framing Analysis System - Frontend Tests', () => {
  it('renders the application header and project title', () => {
    render(<App />)
    const titleElements = screen.getAllByText(/News Bias and Framing Analysis System/i)
    expect(titleElements.length).toBeGreaterThan(0)
  })

  it('renders all primary navigation placeholders', () => {
    const { container } = render(<App />)
    expect(container.querySelector('#nav-dashboard')).toBeDefined()
    expect(container.querySelector('#nav-articles')).toBeDefined()
    expect(container.querySelector('#nav-comparisons')).toBeDefined()
    expect(container.querySelector('#nav-reports')).toBeDefined()
  })

  it('navigates between views when navigation links are clicked', () => {
    const { container } = render(<App />)
    
    // Initial page is Dashboard
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()

    // Navigate to Articles
    const articlesBtn = container.querySelector('#nav-articles')
    fireEvent.click(articlesBtn)
    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeDefined()

    // Navigate to Comparisons
    const comparisonsBtn = container.querySelector('#nav-comparisons')
    fireEvent.click(comparisonsBtn)
    expect(screen.getByRole('heading', { level: 1, name: 'Comparisons' })).toBeDefined()

    // Navigate to Reports
    const reportsBtn = container.querySelector('#nav-reports')
    fireEvent.click(reportsBtn)
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeDefined()

    // Navigate back to Dashboard
    const dashboardBtn = container.querySelector('#nav-dashboard')
    fireEvent.click(dashboardBtn)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })

  it('toggles mobile menu when hamburger button is clicked', () => {
    const { container } = render(<App />)
    const toggleBtn = screen.getByLabelText('Toggle navigation menu')
    const mobileNav = container.querySelector('.mobile-nav')
    
    expect(mobileNav.classList.contains('open')).toBe(false)
    fireEvent.click(toggleBtn)
    expect(mobileNav.classList.contains('open')).toBe(true)
    fireEvent.click(toggleBtn)
    expect(mobileNav.classList.contains('open')).toBe(false)
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
