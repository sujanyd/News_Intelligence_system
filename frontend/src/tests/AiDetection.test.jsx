import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import FlaggedArticlesPanel from '../components/FlaggedArticlesPanel'
import ThemeToggle from '../components/ThemeToggle'
import { fetchArticle, fetchFlaggedAiDetections } from '../api/newsApi'
import { toAiDetection } from '../api/normalize'
import { ApiError } from '../api/client'

// Tests run in mock mode, where AI detection is turned off. Here we turn it
// on and replace the backend calls with fakes.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    AI_DETECTION_AVAILABLE: true,
    fetchFlaggedAiDetections: vi.fn(),
    fetchArticle: vi.fn(),
  }
})

// Shaped like GET /api/articles/ai-detection/flagged (test data only)
function flagged(articleId, likelihood) {
  return toAiDetection({
    id: articleId,
    article_id: articleId,
    ai_likelihood: likelihood,
    confidence_score: 0.88,
    model_name: 'statistical-burstiness-entropy-v1',
    model_version: '1.0.0',
    is_flagged_for_review: true,
    metrics: { sentence_count: 9 },
    interpretation: 'Elevated probability.',
    limitations: 'Not proof.',
    created_at: '2026-11-11T09:00:00',
  })
}

const ARTICLES = {
  7: { id: 7, title: 'Markets rally on rate hopes', source_name: 'Reuters' },
  9: { id: 9, title: 'Council budget explained', source_name: 'BBC News' },
}

describe('FlaggedArticlesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchArticle.mockImplementation(async (id) => {
      if (ARTICLES[id]) return ARTICLES[id]
      throw new ApiError(`Article with ID ${id} not found. (HTTP 404)`, 404)
    })
  })

  it('lists flagged articles with their title, publisher, estimate and confidence', async () => {
    fetchFlaggedAiDetections.mockResolvedValue([flagged(7, 0.82), flagged(9, 0.77)])
    render(<FlaggedArticlesPanel onOpenArticle={() => {}} />)

    const table = await screen.findByRole('table', { name: 'Articles flagged for editorial review' })
    expect(fetchFlaggedAiDetections).toHaveBeenCalledWith({ limit: 10 })
    expect(within(table).getByText('Markets rally on rate hopes')).toBeDefined()
    expect(within(table).getByText('Reuters')).toBeDefined()
    expect(within(table).getByText('82% · needs review')).toBeDefined()
    expect(within(table).getAllByText('88%')).toHaveLength(2)
    expect(screen.getByText('2 flagged')).toBeDefined()
    // Never called AI-generated
    expect(screen.getByText('not proof')).toBeDefined()
  })

  it('loads each article once, even when it was checked twice', async () => {
    fetchFlaggedAiDetections.mockResolvedValue([flagged(7, 0.82), flagged(7, 0.8)])
    render(<FlaggedArticlesPanel onOpenArticle={() => {}} />)
    await screen.findByRole('table', { name: 'Articles flagged for editorial review' })
    expect(fetchArticle).toHaveBeenCalledTimes(1)
  })

  it('still lists an article whose details cannot be loaded', async () => {
    fetchFlaggedAiDetections.mockResolvedValue([flagged(42, 0.9)])
    render(<FlaggedArticlesPanel onOpenArticle={() => {}} />)
    expect(await screen.findByText('Article #42 (details not loaded)')).toBeDefined()
  })

  it('opens the article details with "View"', async () => {
    fetchFlaggedAiDetections.mockResolvedValue([flagged(7, 0.82)])
    const onOpenArticle = vi.fn()
    render(<FlaggedArticlesPanel onOpenArticle={onOpenArticle} />)
    fireEvent.click(await screen.findByRole('button', { name: 'View details for Markets rally on rate hopes' }))
    expect(onOpenArticle).toHaveBeenCalledWith(7, 'Reuters')
  })

  it('says when nothing is flagged, and that only opened articles were checked', async () => {
    fetchFlaggedAiDetections.mockResolvedValue([])
    render(<FlaggedArticlesPanel onOpenArticle={() => {}} />)
    expect(await screen.findByText('No article is flagged for review')).toBeDefined()
    expect(screen.getByText(/Only articles whose details were opened have been checked/)).toBeDefined()
  })

  it('shows the error with "Try again"', async () => {
    fetchFlaggedAiDetections.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    fetchFlaggedAiDetections.mockResolvedValueOnce([])
    render(<FlaggedArticlesPanel onOpenArticle={() => {}} />)
    expect(await screen.findByText('Could not load the flagged articles.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No article is flagged for review')).toBeDefined()
  })
})

describe('ThemeToggle', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts from the computer setting and switches to light, then back to dark', () => {
    render(<ThemeToggle />)
    // jsdom has no light preference, so the app starts dark
    expect(document.documentElement.dataset.theme).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('news-intelligence-theme')).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('remembers the picked theme', () => {
    window.localStorage.setItem('news-intelligence-theme', 'light')
    render(<ThemeToggle />)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeDefined()
  })

  it('still switches when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('flagged articles request (live mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses GET /articles/ai-detection/flagged with limit and offset', async () => {
    vi.doUnmock('../api/newsApi')
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ article_id: 7, ai_likelihood: 0.8, is_flagged_for_review: true }]),
    }))
    vi.stubGlobal('fetch', fakeFetch)
    const api = await import('../api/newsApi')

    const result = await api.fetchFlaggedAiDetections({ limit: 10 })
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/ai-detection/flagged?limit=10&offset=0')
    expect(result[0].is_flagged_for_review).toBe(true)
  })
})
