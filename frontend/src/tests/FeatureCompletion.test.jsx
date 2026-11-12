import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import MatchActivityPanel from '../components/MatchActivityPanel'
import SimilarArticleCard from '../components/SimilarArticleCard'
import { CoverageTimeline, PublisherList } from '../components/CoverageTimeline'
import Articles from '../pages/Articles'
import Sources from '../pages/Sources'
import { NavigationContext } from '../navigation'
import { countPublishers } from '../utils/publishers'
import { fetchRecentMatchActivity } from '../api/newsApi'
import { resetMockData } from '../mocks/mockApi'

// Keep the real API functions (mock mode), but let single tests replace some
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    fetchRecentMatchActivity: vi.fn(realModule.fetchRecentMatchActivity),
  }
})

const PAIR = {
  id: 7,
  article_id_1: 1,
  article_id_2: 2,
  match_label: 'SAME',
  similarity_score: 0.91,
  confidence_score: 0.8,
  created_at: '2026-11-12T10:00:00Z',
  article_a: { id: 1, title: 'Budget passes', source_name: 'Daily Ledger' },
  article_b: { id: 2, title: 'Council approves budget', source_name: 'Global Wire' },
}

describe('MatchActivityPanel', () => {
  beforeEach(() => {
    resetMockData()
    vi.clearAllMocks()
  })

  it('shows the SAME / RELATED / DIFFERENT counts and keeps similarity and confidence apart', async () => {
    fetchRecentMatchActivity.mockResolvedValueOnce({
      articlesChecked: 10,
      articlesWithMatches: 2,
      matches: [PAIR],
      counts: { SAME: 1, RELATED: 0, DIFFERENT: 0 },
      failedArticles: 0,
    })
    render(<MatchActivityPanel onOpenArticle={() => {}} />)

    expect(await screen.findByText(/1 classified pair/)).toBeDefined()
    expect(screen.getByRole('img', { name: 'SAME: 1, RELATED: 0, DIFFERENT: 0' })).toBeDefined()
    expect(screen.getByText(/Similarity 91% · Confidence 80%/)).toBeDefined()
  })

  it('opens an article of a pair', async () => {
    const onOpenArticle = vi.fn()
    fetchRecentMatchActivity.mockResolvedValueOnce({
      articlesChecked: 10,
      articlesWithMatches: 2,
      matches: [PAIR],
      counts: { SAME: 1, RELATED: 0, DIFFERENT: 0 },
      failedArticles: 0,
    })
    render(<MatchActivityPanel onOpenArticle={onOpenArticle} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Open Budget passes (SAME pair)' }))
    expect(onOpenArticle).toHaveBeenCalledWith(1, 'Daily Ledger')
  })

  it('says so when no pair is classified yet', async () => {
    fetchRecentMatchActivity.mockResolvedValueOnce({
      articlesChecked: 10,
      articlesWithMatches: 0,
      matches: [],
      counts: { SAME: 0, RELATED: 0, DIFFERENT: 0 },
      failedArticles: 0,
    })
    render(<MatchActivityPanel onOpenArticle={() => {}} />)
    expect(await screen.findByText('No classified pairs yet')).toBeDefined()
  })

  it('shows the error with a retry button', async () => {
    fetchRecentMatchActivity.mockRejectedValueOnce(new Error('Backend down'))
    render(<MatchActivityPanel onOpenArticle={() => {}} />)
    expect(await screen.findByText('Backend down')).toBeDefined()
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
  })
})

describe('SimilarArticleCard', () => {
  it('shows the match confidence apart from the similarity score', () => {
    render(
      <SimilarArticleCard
        article={{ article_id: 2, title: 'Council approves budget', similarity_score: 0.91 }}
        matchLabel="RELATED"
        matchConfidence={0.66}
        showMatchLabel
      />
    )
    expect(screen.getByTestId('similarity-score-pill').textContent).toContain('91%')
    expect(screen.getByTestId('match-confidence').textContent).toBe('Match confidence: 66%')
  })
})

describe('CoverageTimeline and PublisherList', () => {
  const articles = [
    { id: 1, title: 'Later report', source_name: 'Global Wire', published_at: '2026-11-12T12:00:00Z' },
    { id: 2, title: 'No time given', source_name: 'Global Wire', published_at: null },
    { id: 3, title: 'First report', source_name: 'Daily Ledger', published_at: '2026-11-12T08:00:00Z' },
  ]

  it('lists articles by publication time, earliest first, untimed last', () => {
    render(<CoverageTimeline articles={articles} />)
    const items = within(screen.getByRole('list', { name: 'Publication timeline' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('First report'),
      expect.stringContaining('Later report'),
      expect.stringContaining('No time given'),
    ])
    expect(screen.getByText(/not the time the event happened/)).toBeDefined()
  })

  it('counts each publisher once, most articles first', () => {
    expect(countPublishers(articles)).toEqual([
      { name: 'Global Wire', count: 2 },
      { name: 'Daily Ledger', count: 1 },
    ])
    render(<PublisherList articles={articles} />)
    expect(screen.getByText('Global Wire · 2 articles')).toBeDefined()
    expect(screen.getByText('Daily Ledger · 1 article')).toBeDefined()
  })
})

describe('Articles page sort and filters', () => {
  beforeEach(() => {
    resetMockData()
    vi.clearAllMocks()
  })

  it('sorts the newest articles by title', async () => {
    render(<Articles />)
    await screen.findByRole('table', { name: 'List of articles' })
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } })

    const table = await screen.findByRole('table', { name: 'List of articles' })
    const firstRow = within(table).getAllByRole('row')[1]
    expect(firstRow.textContent).toContain('Beach clean-up drive collects two tonnes of plastic')
  })

  it('starts filtered to the source given by the Sources page', async () => {
    render(<Articles initialSourceId={3} />)
    await screen.findByRole('table', { name: 'List of articles' })
    expect(screen.getByLabelText('Source').value).toBe('3')
  })
})

describe('Sources page activity', () => {
  beforeEach(() => {
    resetMockData()
    vi.clearAllMocks()
  })

  it("shows each source's article count and opens its articles", async () => {
    const navigate = vi.fn()
    render(
      <NavigationContext.Provider value={navigate}>
        <Sources />
      </NavigationContext.Provider>
    )
    const table = await screen.findByRole('table', { name: 'List of news sources' })
    // Daily Ledger has 3 sample articles
    const row = within(table).getByText('Daily Ledger').closest('tr')
    expect(await within(row).findByText('3 articles')).toBeDefined()

    fireEvent.click(within(row).getByRole('button', { name: 'View articles from Daily Ledger' }))
    expect(navigate).toHaveBeenCalledWith('articles', { sourceId: 1 })
  })
})
