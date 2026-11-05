/**
 * Tests for Similar Articles Interface
 *
 * Covers:
 *   - SimilarArticleCard (title, source, published date, formatted similarity percentage, link)
 *   - Semantic similarity score display ("Semantic similarity: 88%")
 *   - Explicit absence of SAME / RELATED / DIFFERENT classification labels
 *   - SimilarArticlesSection (loading state, successful matches, empty state, API errors, retry)
 *   - Navigation flow: navigating from one article to a similar article and returning to previous
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import SimilarArticleCard from '../components/SimilarArticleCard'
import SimilarArticlesSection from '../components/SimilarArticlesSection'
import ArticleDetails from '../components/ArticleDetails'
import { fetchArticle, fetchMatches, fetchSimilarArticles, runArticleMatching } from '../api/newsApi'

vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    fetchArticle: vi.fn(),
    fetchArticleEmbeddings: vi.fn().mockResolvedValue([]),
    fetchSimilarArticles: vi.fn(),
    fetchMatches: vi.fn().mockResolvedValue([]),
    runArticleMatching: vi.fn(),
  }
})

const MATCH_1 = {
  article_id: 103,
  title: 'Commuters react to planned bus route changes',
  source_name: 'Metro Times',
  source_id: 3,
  url: 'https://metrotimes.example/local/bus-route-changes',
  published_at: '2026-10-25T17:45:00Z',
  similarity_score: 0.884,
  embedding_type: 'headline',
  model_name: 'all-MiniLM-L6-v2',
  vector_id: 'art_103_vec',
}

const MATCH_2 = {
  article_id: 102,
  title: 'New subway extension reduces downtown congestion',
  source_name: 'Global Wire',
  source_id: 2,
  url: 'https://globalwire.example/transport/subway',
  published_at: '2026-10-26T07:15:00Z',
  similarity_score: 0.741,
  embedding_type: 'headline',
  model_name: 'all-MiniLM-L6-v2',
  vector_id: 'art_102_vec',
}

const ARTICLE_101 = {
  id: 101,
  title: 'City council approves new budget for public transport',
  source_id: 1,
  source_name: 'Daily Ledger',
  url: 'https://dailyledger.example/news/transport-budget',
  published_at: '2026-10-26T08:30:00Z',
  retrieved_at: '2026-10-26T09:00:00Z',
  content_availability: 'full_text',
  content: 'The city council voted on Monday to approve a larger budget for buses and trains.',
}

const ARTICLE_103 = {
  id: 103,
  title: 'Commuters react to planned bus route changes',
  source_id: 3,
  source_name: 'Metro Times',
  url: 'https://metrotimes.example/local/bus-route-changes',
  published_at: '2026-10-25T17:45:00Z',
  retrieved_at: '2026-10-25T18:00:00Z',
  content_availability: 'full_text',
  content: 'Riders voiced mixed reactions regarding upcoming bus route modifications.',
}

describe('SimilarArticleCard component', () => {
  it('renders title, source name, publication date, and external link', () => {
    const handleSelect = vi.fn()
    render(<SimilarArticleCard article={MATCH_1} onSelect={handleSelect} />)

    expect(screen.getByText('Commuters react to planned bus route changes')).toBeDefined()
    expect(screen.getByText('Metro Times')).toBeDefined()
    expect(screen.getByText(/Oct 25, 2026/)).toBeDefined()
    expect(screen.getByRole('link', { name: /Original link/i })).toBeDefined()
  })

  it('displays semantic similarity score as a user-friendly percentage', () => {
    render(<SimilarArticleCard article={MATCH_1} />)

    const pill = screen.getByTestId('similarity-score-pill')
    expect(within(pill).getByText('Semantic similarity:')).toBeDefined()
    // 0.884 rounds to 88%
    expect(within(pill).getByText('88%')).toBeDefined()
  })

  it('never turns the similarity score into a SAME / RELATED label by itself', () => {
    const { container } = render(<SimilarArticleCard article={MATCH_1} />)

    expect(container.textContent).not.toMatch(/\bSAME\b/)
    expect(container.textContent).not.toMatch(/\bRELATED\b/)
    expect(container.textContent).not.toMatch(/\bDIFFERENT\b/)
  })

  it('triggers onSelect when clicking the action button or headline', () => {
    const handleSelect = vi.fn()
    render(<SimilarArticleCard article={MATCH_1} onSelect={handleSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /View article/i }))
    expect(handleSelect).toHaveBeenCalledWith(103)

    fireEvent.click(screen.getByRole('button', { name: 'Commuters react to planned bus route changes' }))
    expect(handleSelect).toHaveBeenCalledWith(103)
  })
})

describe('SimilarArticlesSection component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while searching for similar articles', () => {
    fetchSimilarArticles.mockReturnValue(new Promise(() => {}))
    render(<SimilarArticlesSection articleId={101} />)

    expect(screen.getByText(/Searching for semantically similar articles/i)).toBeDefined()
  })

  it('renders list of similar articles with count badge when matches exist', async () => {
    fetchSimilarArticles.mockResolvedValueOnce({
      query_article_id: 101,
      total_matches: 2,
      matches: [MATCH_1, MATCH_2],
    })

    render(<SimilarArticlesSection articleId={101} />)

    expect(await screen.findByText('Commuters react to planned bus route changes')).toBeDefined()
    expect(screen.getByText('New subway extension reduces downtown congestion')).toBeDefined()
    expect(screen.getByText('88%')).toBeDefined()
    expect(screen.getByText('74%')).toBeDefined()
    expect(screen.getByTitle('2 similar articles found')).toBeDefined()
  })

  it('shows empty state when no similar articles are found', async () => {
    fetchSimilarArticles.mockResolvedValueOnce({
      query_article_id: 108,
      total_matches: 0,
      matches: [],
    })

    render(<SimilarArticlesSection articleId={108} />)

    expect(await screen.findByText('No similar articles found')).toBeDefined()
    expect(
      screen.getByText(/No other collected articles meet the semantic similarity criteria/i)
    ).toBeDefined()
  })

  it('handles missing embeddings error with clear guidance', async () => {
    const err = new Error("No 'headline' embedding found for article ID 109. Please generate embeddings first.")
    err.status = 404
    fetchSimilarArticles.mockRejectedValueOnce(err)

    render(<SimilarArticlesSection articleId={109} />)

    expect(await screen.findByTestId('similar-notice-no-embeddings')).toBeDefined()
    expect(screen.getByText('Embeddings Required')).toBeDefined()
    expect(screen.getByText(/Vector embeddings have not been generated for this article yet/i)).toBeDefined()
  })

  it('handles vector database unavailable error with retry button', async () => {
    const err = new Error('Vector service unavailable. Qdrant is offline.')
    err.status = 503
    fetchSimilarArticles.mockRejectedValueOnce(err)

    render(<SimilarArticlesSection articleId={101} />)

    expect(await screen.findByTestId('similar-notice-vectordb-unavailable')).toBeDefined()
    expect(screen.getByText('Vector Service Unavailable')).toBeDefined()

    fetchSimilarArticles.mockResolvedValueOnce({
      query_article_id: 101,
      total_matches: 1,
      matches: [MATCH_1],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry Search' }))
    expect(await screen.findByText('Commuters react to planned bus route changes')).toBeDefined()
  })

  it('handles generic API error with retry button', async () => {
    fetchSimilarArticles.mockRejectedValueOnce(new Error('Network timeout'))

    render(<SimilarArticlesSection articleId={101} />)

    expect(await screen.findByText('Could not load similar articles.')).toBeDefined()
    expect(screen.getByText('Network timeout')).toBeDefined()

    fetchSimilarArticles.mockResolvedValueOnce({
      query_article_id: 101,
      total_matches: 1,
      matches: [MATCH_1],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Commuters react to planned bus route changes')).toBeDefined()
  })
})

describe('ArticleDetails navigation with Similar Articles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to a similar article and allows returning to the previous article', async () => {
    fetchArticle.mockImplementation((id) => {
      if (Number(id) === 101) return Promise.resolve(ARTICLE_101)
      if (Number(id) === 103) return Promise.resolve(ARTICLE_103)
      return Promise.reject(new Error('Not found'))
    })

    fetchSimilarArticles.mockImplementation((id) => {
      if (Number(id) === 101) {
        return Promise.resolve({
          query_article_id: 101,
          total_matches: 1,
          matches: [MATCH_1],
        })
      }
      return Promise.resolve({
        query_article_id: 103,
        total_matches: 0,
        matches: [],
      })
    })

    const handleClose = vi.fn()
    render(<ArticleDetails articleId={101} onClose={handleClose} />)

    // Wait for initial article 101
    expect(await screen.findByText('City council approves new budget for public transport')).toBeDefined()
    expect(await screen.findByText('Commuters react to planned bus route changes')).toBeDefined()

    // Initially, header only has "← Back to articles"
    expect(screen.queryByRole('button', { name: 'Return to previous article' })).toBeNull()

    // Click "View article →" on similar article 103
    fireEvent.click(screen.getByRole('button', { name: /View article: Commuters react/i }))

    // Now article 103 should be displayed in details
    expect(await screen.findByText('Riders voiced mixed reactions regarding upcoming bus route modifications.')).toBeDefined()

    // History navigation button "← Return to previous article" should now appear
    const returnBtn = screen.getByRole('button', { name: 'Return to previous article' })
    expect(returnBtn).toBeDefined()

    // History banner showing previous title
    expect(screen.getByTestId('history-banner')).toBeDefined()

    // Click "← Return to previous article"
    fireEvent.click(returnBtn)

    // Should return to article 101
    expect(await screen.findByText('The city council voted on Monday to approve a larger budget for buses and trains.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Return to previous article' })).toBeNull()
  })
})

describe('Similar articles with their classification', () => {
  const SIMILARITY_RESPONSE = {
    query_article_id: 101,
    query_title: 'City council approves new budget for public transport',
    embedding_type: 'headline',
    model_name: 'all-MiniLM-L6-v2',
    total_matches: 2,
    matches: [MATCH_1, MATCH_2],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSimilarArticles.mockResolvedValue(SIMILARITY_RESPONSE)
  })

  it('shows the stored label, or "Not classified yet" when there is no match', async () => {
    fetchMatches.mockResolvedValue([
      { id: 9, article_id_1: 101, article_id_2: 103, match_label: 'SAME' },
    ])
    render(<SimilarArticlesSection articleId={101} />)

    const card103 = await screen.findByTestId('similar-article-card-103')
    expect(await within(card103).findByText('SAME')).toBeDefined()
    const card102 = screen.getByTestId('similar-article-card-102')
    expect(within(card102).getByText('Not classified yet')).toBeDefined()
    expect(fetchMatches).toHaveBeenCalledWith({ articleId: 101 })
  })

  it('classifies exactly the shown articles, then loads the labels again', async () => {
    fetchMatches.mockResolvedValueOnce([])
    fetchMatches.mockResolvedValueOnce([
      { id: 9, article_id_1: 101, article_id_2: 102, match_label: 'RELATED' },
    ])
    runArticleMatching.mockResolvedValueOnce({ candidates_retrieved: 2, matches: [] })
    render(<SimilarArticlesSection articleId={101} />)
    await screen.findByTestId('similar-article-card-102')

    fireEvent.click(screen.getByRole('button', { name: 'Classify these articles' }))

    const card102 = screen.getByTestId('similar-article-card-102')
    expect(await within(card102).findByText('RELATED')).toBeDefined()
    // Same search as the list: top 5 headline neighbours, no cutoff
    expect(runArticleMatching).toHaveBeenCalledWith(101, { candidateLimit: 5, scoreThreshold: -1 })
  })

  it('still shows the similar articles when classifications cannot load', async () => {
    fetchMatches.mockRejectedValueOnce(new Error('Matches route failed'))
    render(<SimilarArticlesSection articleId={101} />)

    expect(await screen.findByText('Classifications unavailable: Matches route failed')).toBeDefined()
    expect(screen.getByTestId('similar-article-card-103')).toBeDefined()
    expect(screen.queryByText('Not classified yet')).toBeNull()
  })

  it('shows an error when classifying fails', async () => {
    runArticleMatching.mockRejectedValueOnce(new Error('Pairwise matching failed (HTTP 500)'))
    render(<SimilarArticlesSection articleId={101} />)
    await screen.findByTestId('similar-article-card-103')

    fireEvent.click(screen.getByRole('button', { name: 'Classify these articles' }))

    expect(await screen.findByText('Classification failed.')).toBeDefined()
    expect(screen.getByText('Pairwise matching failed (HTTP 500)')).toBeDefined()
  })
})
