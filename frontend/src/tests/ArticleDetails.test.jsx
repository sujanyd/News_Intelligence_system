/**
 * ArticleDetails component tests
 *
 * Covers: loading state, valid article display, API error, 404 / not-found,
 * summary-only content, headline-only content, missing content, navigation
 * back to articles, analysis placeholder, and source information section.
 *
 * fetchArticle is explicitly mocked per-test or with a shared default below,
 * so these tests never depend on the mock backend's in-memory state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import ArticleDetails from '../components/ArticleDetails'
import { fetchArticle } from '../api/newsApi'
import { ApiError } from '../api/client'

// Replace fetchArticle with a completely controllable spy.
// Each test sets the desired resolved/rejected value explicitly.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    fetchArticle: vi.fn(),
  }
})

// ── Shared article fixtures ───────────────────────────────────────────────────

const ARTICLE_FULL = {
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

const ARTICLE_SUMMARY_ONLY = {
  id: 107,
  title: 'Electric car sales rise for the third month in a row',
  source_id: 2,
  source_name: 'Global Wire',
  url: 'https://globalwire.example/business/electric-car-sales',
  published_at: '2026-10-24T13:40:00Z',
  retrieved_at: '2026-10-24T14:00:00Z',
  content_availability: 'summary_only',
  content: 'Sales of electric cars went up again last month.',
}

const ARTICLE_HEADLINE_ONLY = {
  id: 103,
  title: 'Commuters react to planned bus route changes',
  source_id: 3,
  source_name: 'Metro Times',
  url: 'https://metrotimes.example/local/bus-route-changes',
  published_at: '2026-10-25T17:45:00Z',
  retrieved_at: '2026-10-25T18:05:00Z',
  content_availability: 'headline_only',
  content: null,
}

const ARTICLE_HEADLINE_EMPTY_CONTENT = {
  id: 109,
  title: 'Hospital opens new emergency wing',
  source_id: 4,
  source_name: 'The Civic Post',
  url: 'https://civicpost.example/health/emergency-wing',
  published_at: '2026-10-23T09:30:00Z',
  retrieved_at: '2026-10-23T09:50:00Z',
  content_availability: 'headline_only',
  content: '',
}

// Default props used by most tests
const DEFAULT_PROPS = {
  articleId: 101,
  sourceName: 'Daily Ledger',
  onClose: vi.fn(),
}

describe('ArticleDetails component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: return a valid full-text article for articleId=101
    fetchArticle.mockResolvedValue(ARTICLE_FULL)
  })

  // ── Loading state ─────────────────────────────────────────────────────────
  it('shows a loading spinner while the article is being fetched', () => {
    // Freeze the fetch so it never resolves
    fetchArticle.mockReturnValue(new Promise(() => {}))
    render(<ArticleDetails {...DEFAULT_PROPS} />)

    expect(screen.getByText('Loading article...')).toBeDefined()
    expect(screen.getByRole('status')).toBeDefined()
  })

  // ── Valid article: basic metadata ─────────────────────────────────────────
  it('displays the article title, source and both dates when fully loaded', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)

    // Title appears in the card header once the load completes
    expect(
      await screen.findByText('City council approves new budget for public transport')
    ).toBeDefined()

    const panel = screen.getByRole('region', { name: 'Article details' })
    // 'Daily Ledger' appears in both the Article Information and Source Information sections
    expect(within(panel).getAllByText('Daily Ledger').length).toBeGreaterThanOrEqual(1)

    // Both date term cells should be visible
    expect(within(panel).getByText('Published')).toBeDefined()
    expect(within(panel).getByText('Retrieved')).toBeDefined()
  })

  // ── Valid article: URL link ───────────────────────────────────────────────
  it('renders the original article URL as a clickable link', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')

    const panel = screen.getByRole('region', { name: 'Article details' })
    const link = within(panel).getByRole('link')
    expect(link.href).toContain('dailyledger.example')
    expect(link.target).toBe('_blank')
  })

  // ── Full-text article content ─────────────────────────────────────────────
  it('shows the full article content when content_availability is full_text', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')

    expect(
      screen.getByText(/The city council voted on Monday/)
    ).toBeDefined()
    expect(screen.queryByTestId('content-notice-headline')).toBeNull()
    expect(screen.queryByTestId('content-notice-missing')).toBeNull()
  })

  // ── Summary-only article ──────────────────────────────────────────────────
  it('shows a summary label and notes it is not the full text for summary_only articles', async () => {
    fetchArticle.mockResolvedValueOnce(ARTICLE_SUMMARY_ONLY)
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={107} />)

    await screen.findByText('Electric car sales rise for the third month in a row')

    // 'Summary only' appears twice: in the section heading badge and in the content notice
    expect(screen.getAllByText('Summary only').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/This is a summary, not the full article text/i)).toBeDefined()
    expect(screen.getByTestId('content-body')).toBeDefined()
    expect(screen.getByText(/Sales of electric cars went up again last month/)).toBeDefined()
  })

  // ── Headline-only article ─────────────────────────────────────────────────
  it('shows a notice that only the headline is available for headline_only articles', async () => {
    fetchArticle.mockResolvedValueOnce(ARTICLE_HEADLINE_ONLY)
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={103} />)

    await screen.findByText('Commuters react to planned bus route changes')

    expect(screen.getByTestId('content-notice-headline')).toBeDefined()
    expect(screen.getByText(/Only the headline was collected/i)).toBeDefined()
    expect(screen.queryByTestId('content-body')).toBeNull()
  })

  // ── Headline-only with empty string content ───────────────────────────────
  it('still shows the headline-only notice when content is an empty string', async () => {
    fetchArticle.mockResolvedValueOnce(ARTICLE_HEADLINE_EMPTY_CONTENT)
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={109} />)

    await screen.findByText('Hospital opens new emergency wing')
    expect(screen.getByTestId('content-notice-headline')).toBeDefined()
  })

  // ── Missing content (availability set but no text) ────────────────────────
  it('shows a missing-content notice when content is null but availability is not headline_only', async () => {
    fetchArticle.mockResolvedValueOnce({
      id: 999,
      title: 'Article with missing content',
      source_id: 1,
      source_name: 'Test Source',
      url: 'https://example.com/test',
      published_at: '2026-10-25T08:00:00Z',
      retrieved_at: '2026-10-25T09:00:00Z',
      content_availability: 'full_text',
      content: null,
    })
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={999} />)
    await screen.findByText('Article with missing content')

    expect(screen.getByTestId('content-notice-missing')).toBeDefined()
    expect(screen.getByText('Content not available')).toBeDefined()
  })

  // ── Missing URL ───────────────────────────────────────────────────────────
  it('shows "URL not available" when the article has no url', async () => {
    fetchArticle.mockResolvedValueOnce({
      id: 998,
      title: 'No URL article',
      source_id: 2,
      source_name: 'Wire',
      url: '',
      published_at: null,
      retrieved_at: null,
      content_availability: 'full_text',
      content: 'Some content.',
    })
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={998} />)
    await screen.findByText('No URL article')

    expect(screen.getByText('URL not available')).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
  })

  // ── API error ─────────────────────────────────────────────────────────────
  it('shows an error message and a retry button when the API fails', async () => {
    fetchArticle.mockRejectedValueOnce(
      new Error('Could not reach the backend at http://backend.test.')
    )
    render(<ArticleDetails {...DEFAULT_PROPS} />)

    expect(await screen.findByText('Could not load this article.')).toBeDefined()
    expect(screen.getByText(/Could not reach the backend/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  // ── Retry after error ─────────────────────────────────────────────────────
  it('retries the fetch when the user clicks "Try again"', async () => {
    // First call fails, second succeeds (default mock returns ARTICLE_FULL)
    fetchArticle.mockRejectedValueOnce(new Error('Server is down.'))
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('Could not load this article.')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByText('City council approves new budget for public transport')
    ).toBeDefined()
  })

  // ── Article not found (404) ───────────────────────────────────────────────
  it('shows an article-not-found message for a 404 error', async () => {
    const notFoundError = new ApiError('Article with ID 9999 not found (HTTP 404)', 404)
    fetchArticle.mockRejectedValueOnce(notFoundError)
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={9999} />)

    expect(await screen.findByText('Article not found.')).toBeDefined()
    expect(screen.getByText(/Article #9999 no longer exists/)).toBeDefined()
    // 404 shows a warning with no retry button
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  // ── Close / back navigation ───────────────────────────────────────────────
  it('calls onClose when the "Back to articles" button is clicked', async () => {
    const onClose = vi.fn()
    render(<ArticleDetails {...DEFAULT_PROPS} onClose={onClose} />)
    await screen.findByText('City council approves new budget for public transport')

    fireEvent.click(screen.getByRole('button', { name: /Back to articles/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the "Back to articles" button even while loading', () => {
    fetchArticle.mockReturnValue(new Promise(() => {}))
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: /Back to articles/i })).toBeDefined()
  })

  // ── Section structure ─────────────────────────────────────────────────────
  it('renders the four named sections after a successful load', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')

    expect(screen.getByText('Article Information')).toBeDefined()
    expect(screen.getByText('Article Content')).toBeDefined()
    expect(screen.getByText('Source Information')).toBeDefined()
    expect(screen.getByText('Analysis')).toBeDefined()
  })

  // ── Analysis placeholder ──────────────────────────────────────────────────
  it('shows the analysis placeholder message and all five future feature cards', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')

    const analysisSection = screen.getByTestId('analysis-section')
    expect(
      within(analysisSection).getByText(
        'Analysis has not been generated for this article yet.'
      )
    ).toBeDefined()

    expect(screen.getByTestId('analysis-card-ai-detection')).toBeDefined()
    expect(screen.getByTestId('analysis-card-tone')).toBeDefined()
    expect(screen.getByTestId('analysis-card-framing')).toBeDefined()
    expect(screen.getByTestId('analysis-card-topics')).toBeDefined()
    expect(screen.getByTestId('analysis-card-comparison')).toBeDefined()
  })

  it('shows "Coming soon" badge in the Analysis section', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')
    expect(screen.getByText('Coming soon')).toBeDefined()
  })

  // ── Source Information section ────────────────────────────────────────────
  it('shows the source name in the Source Information section', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')

    const panel = screen.getByRole('region', { name: 'Article details' })
    expect(within(panel).getAllByText('Daily Ledger').length).toBeGreaterThanOrEqual(1)
    expect(within(panel).getByText('News source')).toBeDefined()
  })

  // ── Content availability badge in Content section ─────────────────────────
  it('shows the correct content availability badge', async () => {
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('City council approves new budget for public transport')
    // ARTICLE_FULL is full_text
    expect(screen.getByText('Full text')).toBeDefined()
  })

  // ── Sections absent on errors ─────────────────────────────────────────────
  it('does not render the sections when there is an API error', async () => {
    fetchArticle.mockRejectedValueOnce(new Error('Network error'))
    render(<ArticleDetails {...DEFAULT_PROPS} />)
    await screen.findByText('Could not load this article.')

    expect(screen.queryByText('Article Information')).toBeNull()
    expect(screen.queryByText('Article Content')).toBeNull()
    expect(screen.queryByTestId('analysis-section')).toBeNull()
  })

  // ── Sections absent on 404 ────────────────────────────────────────────────
  it('does not render the sections when the article is not found', async () => {
    fetchArticle.mockRejectedValueOnce(new ApiError('Not found', 404))
    render(<ArticleDetails {...DEFAULT_PROPS} articleId={0} />)
    await screen.findByText('Article not found.')

    expect(screen.queryByText('Article Information')).toBeNull()
    expect(screen.queryByTestId('analysis-section')).toBeNull()
  })

  // ── Source fallback from prop ─────────────────────────────────────────────
  it('uses the sourceName prop when the article has no source_name', async () => {
    fetchArticle.mockResolvedValueOnce({
      ...ARTICLE_FULL,
      source_name: null,
    })
    render(<ArticleDetails {...DEFAULT_PROPS} sourceName="Prop Source" />)
    await screen.findByText('City council approves new budget for public transport')

    expect(screen.getAllByText('Prop Source').length).toBeGreaterThanOrEqual(1)
  })
})
