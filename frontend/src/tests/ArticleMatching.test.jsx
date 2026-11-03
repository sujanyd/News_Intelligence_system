/**
 * Tests for Article Matching & Classification Review Interface
 *
 * Covers:
 *   - ClassificationBadge: renders SAME, RELATED, DIFFERENT, unknown labels
 *   - MatchedPairCard: renders pair titles, source, date, score pills, compare button
 *   - ArticleMatchingSection: loading, empty, error states; filter tabs; search
 *   - SideBySideComparison: column A/B headlines, metrics explainer, review read-only notice
 *   - Review support when backend review endpoints are unavailable (read-only mode)
 *   - Navigation from MatchedPairCard to SideBySideComparison and back
 *   - Missing/null metadata handling
 *
 * Rules enforced in all tests:
 *   - Classification labels (SAME, RELATED, DIFFERENT) are NEVER derived from similarity score
 *   - No fake API data in production — mocks used only in test / mock mode
 *   - Review changes cannot be claimed as saved when backend endpoint is unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import React from 'react'

import ClassificationBadge from '../components/ClassificationBadge'
import MatchedPairCard from '../components/MatchedPairCard'
import SideBySideComparison from '../components/SideBySideComparison'
import ArticleMatchingSection from '../components/ArticleMatchingSection'
import { fetchMatches, fetchArticle } from '../api/newsApi'

vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    fetchMatches: vi.fn(),
    fetchArticle: vi.fn(),
    submitMatchReview: vi.fn(),
    MATCH_REVIEW_AVAILABLE: false,
  }
})

// ── Shared Match Fixtures ──────────────────────────────────────────────────────

const MATCH_SAME = {
  id: 1,
  article_id_1: 101,
  article_id_2: 102,
  match_label: 'SAME',
  similarity_score: 0.912,
  confidence_score: 0.94,
  model_name: 'all-MiniLM-L6-v2 + Pairwise Classifier',
  review_status: 'unreviewed',
  reviewed_at: null,
  reviewer_notes: null,
  created_at: '2026-10-26T10:00:00Z',
  article_a: {
    id: 101,
    title: 'City council approves new budget for public transport',
    source_name: 'Daily Ledger',
    source_id: 1,
    published_at: '2026-10-26T08:30:00Z',
    content_availability: 'full_text',
    content: 'The city council voted on Monday to approve a larger budget for buses and trains.',
    url: 'https://dailyledger.example/news/transport-budget',
  },
  article_b: {
    id: 102,
    title: 'Transport budget passes after long council debate',
    source_name: 'Global Wire',
    source_id: 2,
    published_at: '2026-10-26T09:10:00Z',
    content_availability: 'full_text',
    content:
      'After a debate lasting four hours, the council passed the transport budget.',
    url: 'https://globalwire.example/stories/council-transport-vote',
  },
}

const MATCH_RELATED = {
  id: 2,
  article_id_1: 101,
  article_id_2: 103,
  match_label: 'RELATED',
  similarity_score: 0.884,
  confidence_score: 0.86,
  model_name: 'all-MiniLM-L6-v2 + Pairwise Classifier',
  review_status: 'reviewed',
  reviewed_at: '2026-10-27T14:30:00Z',
  reviewer_notes: 'Both discuss transit policy from differing perspectives.',
  created_at: '2026-10-26T10:05:00Z',
  article_a: {
    id: 101,
    title: 'City council approves new budget for public transport',
    source_name: 'Daily Ledger',
    source_id: 1,
    published_at: '2026-10-26T08:30:00Z',
    content_availability: 'full_text',
    content: 'The city council voted on Monday to approve a larger budget for buses and trains.',
    url: 'https://dailyledger.example/news/transport-budget',
  },
  article_b: {
    id: 103,
    title: 'Commuters react to planned bus route changes',
    source_name: 'Metro Times',
    source_id: 3,
    published_at: '2026-10-25T17:45:00Z',
    content_availability: 'headline_only',
    content: null,
    url: 'https://metrotimes.example/local/bus-route-changes',
  },
}

const MATCH_DIFFERENT = {
  id: 3,
  article_id_1: 101,
  article_id_2: 104,
  match_label: 'DIFFERENT',
  similarity_score: 0.128,
  confidence_score: 0.98,
  model_name: 'all-MiniLM-L6-v2 + Pairwise Classifier',
  review_status: 'unreviewed',
  reviewed_at: null,
  reviewer_notes: null,
  created_at: '2026-10-26T10:10:00Z',
  article_a: {
    id: 101,
    title: 'City council approves new budget for public transport',
    source_name: 'Daily Ledger',
    source_id: 1,
    published_at: '2026-10-26T08:30:00Z',
    content_availability: 'full_text',
    content: 'The city council voted on Monday to approve a larger budget for buses and trains.',
    url: 'https://dailyledger.example/news/transport-budget',
  },
  article_b: {
    id: 104,
    title: 'Heavy rain expected across the region this weekend',
    source_name: 'The Civic Post',
    source_id: 4,
    published_at: '2026-10-25T06:00:00Z',
    content_availability: 'full_text',
    content: 'Weather officials expect heavy rain from Friday night until Sunday.',
    url: 'https://civicpost.example/weather/weekend-rain',
  },
}

const MATCH_NO_METADATA = {
  id: 4,
  article_id_1: 104,
  article_id_2: 105,
  match_label: 'RELATED',
  similarity_score: null,
  confidence_score: null,
  model_name: null,
  review_status: null,
  reviewed_at: null,
  reviewer_notes: null,
  created_at: null,
  article_a: {
    id: 104,
    title: 'Heavy rain expected across the region this weekend',
    source_name: null,
    published_at: null,
    content: null,
    url: '',
  },
  article_b: {
    id: 105,
    title: 'Fishing communities prepare for weekend storm',
    source_name: null,
    published_at: null,
    content: null,
    url: '',
  },
}

// ── ClassificationBadge ────────────────────────────────────────────────────────

describe('ClassificationBadge', () => {
  it('renders SAME badge with correct test id and text', () => {
    const { getByTestId } = render(<ClassificationBadge label="SAME" />)
    const badge = getByTestId('classification-badge-same')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('SAME')
  })

  it('renders RELATED badge with correct test id and text', () => {
    const { getByTestId } = render(<ClassificationBadge label="RELATED" />)
    const badge = getByTestId('classification-badge-related')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('RELATED')
  })

  it('renders DIFFERENT badge with correct test id and text', () => {
    const { getByTestId } = render(<ClassificationBadge label="DIFFERENT" />)
    const badge = getByTestId('classification-badge-different')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('DIFFERENT')
  })

  it('does NOT use similarity scores as labels', () => {
    const { container } = render(<ClassificationBadge label="SAME" />)
    // Classification label is a categorical name, not a numeric score
    expect(container.textContent).not.toMatch(/\d+%/)
    expect(container.textContent).not.toMatch(/0\.\d+/)
  })

  it('renders unknown badge for unrecognized label', () => {
    const { getByTestId } = render(<ClassificationBadge label="BOGUS" />)
    expect(getByTestId('classification-badge-bogus')).toBeDefined()
  })

  it('renders unknown badge when label is empty string', () => {
    const { getByTestId } = render(<ClassificationBadge label="" />)
    expect(getByTestId('classification-badge-unknown')).toBeDefined()
  })
})

// ── MatchedPairCard ───────────────────────────────────────────────────────────

describe('MatchedPairCard', () => {
  it('renders SAME label with Article A and Article B titles', () => {
    render(<MatchedPairCard match={MATCH_SAME} />)
    expect(
      screen.getByTestId('classification-badge-same')
    ).toBeDefined()
    expect(
      screen.getByText('City council approves new budget for public transport')
    ).toBeDefined()
    expect(
      screen.getByText('Transport budget passes after long council debate')
    ).toBeDefined()
  })

  it('renders RELATED label', () => {
    render(<MatchedPairCard match={MATCH_RELATED} />)
    expect(screen.getByTestId('classification-badge-related')).toBeDefined()
  })

  it('renders DIFFERENT label', () => {
    render(<MatchedPairCard match={MATCH_DIFFERENT} />)
    expect(screen.getByTestId('classification-badge-different')).toBeDefined()
  })

  it('displays similarity score separately from classification label', () => {
    render(<MatchedPairCard match={MATCH_SAME} />)
    // Classification label as badge
    expect(screen.getByTestId('classification-badge-same')).toBeDefined()
    // Similarity as separate metric pill
    const simPill = screen.getByTestId('mpc-similarity-pill')
    expect(within(simPill).getByText('91%')).toBeDefined()
    // The label "SAME" must NOT come from the score
    expect(within(simPill).queryByText(/SAME/i)).toBeNull()
  })

  it('displays confidence score separately from classification label', () => {
    render(<MatchedPairCard match={MATCH_SAME} />)
    const confPill = screen.getByTestId('mpc-confidence-pill')
    expect(within(confPill).getByText('94%')).toBeDefined()
    expect(within(confPill).queryByText(/SAME/i)).toBeNull()
  })

  it('shows N/A when similarity score is null', () => {
    render(<MatchedPairCard match={MATCH_NO_METADATA} />)
    const simPill = screen.getByTestId('mpc-similarity-pill')
    expect(within(simPill).getByText('N/A')).toBeDefined()
  })

  it('shows N/A when confidence score is null', () => {
    render(<MatchedPairCard match={MATCH_NO_METADATA} />)
    const confPill = screen.getByTestId('mpc-confidence-pill')
    expect(within(confPill).getByText('N/A')).toBeDefined()
  })

  it('shows source names for both articles', () => {
    render(<MatchedPairCard match={MATCH_SAME} />)
    expect(screen.getByText(/Daily Ledger/)).toBeDefined()
    expect(screen.getByText(/Global Wire/)).toBeDefined()
  })

  it('shows reviewed badge for reviewed match', () => {
    render(<MatchedPairCard match={MATCH_RELATED} />)
    expect(screen.getByTestId('mpc-review-status').textContent).toContain('Reviewed')
  })

  it('shows unreviewed badge for unreviewed match', () => {
    render(<MatchedPairCard match={MATCH_SAME} />)
    expect(screen.getByTestId('mpc-review-status').textContent).toContain('Unreviewed')
  })

  it('calls onCompare when Compare button is clicked', () => {
    const handleCompare = vi.fn()
    render(<MatchedPairCard match={MATCH_SAME} onCompare={handleCompare} />)
    const btn = screen.getByRole('button', { name: /Compare Side-by-Side/i })
    fireEvent.click(btn)
    expect(handleCompare).toHaveBeenCalledWith(MATCH_SAME)
  })

  it('renders without crashing when metadata fields are null', () => {
    render(<MatchedPairCard match={MATCH_NO_METADATA} />)
    expect(screen.getByText('Heavy rain expected across the region this weekend')).toBeDefined()
    expect(screen.getByText('Fishing communities prepare for weekend storm')).toBeDefined()
  })
})

// ── SideBySideComparison ──────────────────────────────────────────────────────

describe('SideBySideComparison', () => {
  beforeEach(() => {
    fetchArticle.mockResolvedValue({
      id: 101,
      title: 'Mocked article',
      content: null,
      content_availability: null,
    })
  })

  it('renders headline for Article A and Article B', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    const columnA = screen.getByTestId('sbs-column-article-a')
    const columnB = screen.getByTestId('sbs-column-article-b')
    expect(
      within(columnA).getByText('City council approves new budget for public transport')
    ).toBeDefined()
    expect(
      within(columnB).getByText('Transport budget passes after long council debate')
    ).toBeDefined()
  })

  it('renders source and published date in both columns', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    expect(screen.getAllByText('Daily Ledger').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Global Wire').length).toBeGreaterThan(0)
  })

  it('renders existing article content for SAME matched pair', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    const columnA = screen.getByTestId('sbs-column-article-a')
    expect(
      within(columnA).getByTestId('sbs-article-a-content')
    ).toBeDefined()
  })

  it('shows empty content notice when article content is null', async () => {
    render(<SideBySideComparison match={MATCH_RELATED} onClose={vi.fn()} />)
    const columnB = screen.getByTestId('sbs-column-article-b')
    expect(
      await within(columnB).findByText(/Full text content is not provided by the publisher/i)
    ).toBeDefined()
  })

  it('displays similarity score metric separately from classification label', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    const simCard = screen.getByTestId('sbs-similarity-card')
    expect(within(simCard).getByText('91%')).toBeDefined()
    // Similarity card must NOT show classification label
    expect(within(simCard).queryByText(/^SAME$/)).toBeNull()
  })

  it('displays confidence score metric separately from classification label', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    const confCard = screen.getByTestId('sbs-confidence-card')
    expect(within(confCard).getByText('94%')).toBeDefined()
    expect(within(confCard).queryByText(/^SAME$/)).toBeNull()
  })

  it('shows "Not available" when similarity_score is null', () => {
    render(<SideBySideComparison match={MATCH_NO_METADATA} onClose={vi.fn()} />)
    const simCard = screen.getByTestId('sbs-similarity-card')
    expect(within(simCard).getByText('Not available')).toBeDefined()
  })

  it('shows "Not available" when confidence_score is null', () => {
    render(<SideBySideComparison match={MATCH_NO_METADATA} onClose={vi.fn()} />)
    const confCard = screen.getByTestId('sbs-confidence-card')
    expect(within(confCard).getByText('Not available')).toBeDefined()
  })

  it('shows read-only review notice when isReviewSupported is false', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} isReviewSupported={false} />)
    expect(screen.getByTestId('review-read-only-notice')).toBeDefined()
    expect(screen.getByText('Read-Only Review Mode')).toBeDefined()
  })

  it('shows review form when isReviewSupported is true', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} isReviewSupported={true} />)
    expect(screen.getByTestId('review-edit-form')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save Review' })).toBeDefined()
  })

  it('shows review status on the method card', () => {
    render(<SideBySideComparison match={MATCH_SAME} onClose={vi.fn()} />)
    const methodCard = screen.getByTestId('sbs-method-card')
    expect(within(methodCard).getByTestId('sbs-review-status-tag')).toBeDefined()
  })

  it('calls onClose when Back button is clicked', () => {
    const handleClose = vi.fn()
    render(<SideBySideComparison match={MATCH_SAME} onClose={handleClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Back to Matched Pairs/i }))
    expect(handleClose).toHaveBeenCalledOnce()
  })

  it('renders null when match prop is null', () => {
    const { container } = render(<SideBySideComparison match={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── ArticleMatchingSection ─────────────────────────────────────────────────────

describe('ArticleMatchingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while fetching matches', () => {
    fetchMatches.mockReturnValue(new Promise(() => {}))
    render(<ArticleMatchingSection />)
    expect(screen.getByTestId('ams-loading')).toBeDefined()
    expect(screen.getByText(/Loading matched article pairs/i)).toBeDefined()
  })

  it('renders SAME, RELATED, and DIFFERENT matches in the list', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_RELATED, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    expect(await screen.findByTestId('matched-pair-card-1')).toBeDefined()
    expect(screen.getByTestId('matched-pair-card-2')).toBeDefined()
    expect(screen.getByTestId('matched-pair-card-3')).toBeDefined()
    expect(screen.getByTestId('classification-badge-same')).toBeDefined()
    expect(screen.getByTestId('classification-badge-related')).toBeDefined()
    expect(screen.getByTestId('classification-badge-different')).toBeDefined()
  })

  it('shows empty state when no matches are returned', async () => {
    fetchMatches.mockResolvedValueOnce([])
    render(<ArticleMatchingSection />)
    expect(await screen.findByTestId('ams-empty')).toBeDefined()
    expect(screen.getByText('No matched article pairs found')).toBeDefined()
  })

  it('shows error state and retry button on API failure', async () => {
    fetchMatches.mockRejectedValueOnce(new Error('Network error'))
    render(<ArticleMatchingSection />)
    expect(await screen.findByTestId('ams-error')).toBeDefined()
    expect(screen.getByText('Network error')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  it('filters to SAME matches when SAME tab is clicked', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_RELATED, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-1')

    fireEvent.click(screen.getByRole('tab', { name: /SAME/ }))

    expect(screen.getByTestId('matched-pair-card-1')).toBeDefined()
    expect(screen.queryByTestId('matched-pair-card-2')).toBeNull()
    expect(screen.queryByTestId('matched-pair-card-3')).toBeNull()
  })

  it('filters to RELATED matches when RELATED tab is clicked', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_RELATED, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-2')

    fireEvent.click(screen.getByRole('tab', { name: /RELATED/ }))

    expect(screen.queryByTestId('matched-pair-card-1')).toBeNull()
    expect(screen.getByTestId('matched-pair-card-2')).toBeDefined()
    expect(screen.queryByTestId('matched-pair-card-3')).toBeNull()
  })

  it('filters to DIFFERENT matches when DIFFERENT tab is clicked', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_RELATED, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-3')

    fireEvent.click(screen.getByRole('tab', { name: /DIFFERENT/ }))

    expect(screen.queryByTestId('matched-pair-card-1')).toBeNull()
    expect(screen.queryByTestId('matched-pair-card-2')).toBeNull()
    expect(screen.getByTestId('matched-pair-card-3')).toBeDefined()
  })

  it('shows all pairs when All tab is selected', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_RELATED, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-1')

    // Switch to SAME then back to ALL
    fireEvent.click(screen.getByRole('tab', { name: /SAME/ }))
    fireEvent.click(screen.getByRole('tab', { name: /All/ }))

    expect(screen.getByTestId('matched-pair-card-1')).toBeDefined()
    expect(screen.getByTestId('matched-pair-card-2')).toBeDefined()
    expect(screen.getByTestId('matched-pair-card-3')).toBeDefined()
  })

  it('filters by title search query', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME, MATCH_DIFFERENT])
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-1')

    const searchInput = screen.getByRole('searchbox', {
      name: /Filter article pairs by headline or source/i,
    })
    fireEvent.change(searchInput, { target: { value: 'rain' } })

    expect(screen.queryByTestId('matched-pair-card-1')).toBeNull()
    expect(screen.getByTestId('matched-pair-card-3')).toBeDefined()
  })

  it('navigates to SideBySideComparison when Compare is clicked and returns to list', async () => {
    fetchMatches.mockResolvedValueOnce([MATCH_SAME])
    fetchArticle.mockResolvedValue({ id: 101, title: 'x', content: null })
    render(<ArticleMatchingSection />)
    await screen.findByTestId('matched-pair-card-1')

    const compareBtn = screen.getByRole('button', { name: /Compare Side-by-Side/i })
    fireEvent.click(compareBtn)

    // SideBySideComparison should appear
    expect(screen.getByTestId('side-by-side-comparison')).toBeDefined()

    // Navigate back
    fireEvent.click(screen.getByRole('button', { name: /Back to Matched Pairs/i }))

    // List should be visible again
    await waitFor(() => {
      expect(screen.getByTestId('article-matching-section')).toBeDefined()
    })
  })
})

// ── Normalize: toArticleMatch & toArticleMatchList ────────────────────────────

describe('normalize.toArticleMatch', () => {
  let toArticleMatch, toArticleMatchList, VALID_MATCH_LABELS
  beforeEach(async () => {
    const mod = await import('../api/normalize')
    toArticleMatch = mod.toArticleMatch
    toArticleMatchList = mod.toArticleMatchList
    VALID_MATCH_LABELS = mod.VALID_MATCH_LABELS
  })

  it('normalizes a valid SAME match pair', () => {
    const result = toArticleMatch({
      id: 1,
      article_id_1: 101,
      article_id_2: 102,
      match_label: 'SAME',
      similarity_score: 0.91,
      confidence_score: 0.94,
      model_name: 'model-v1',
      review_status: 'unreviewed',
    })
    expect(result.match_label).toBe('SAME')
    expect(result.article_id_1).toBe(101)
    expect(result.article_id_2).toBe(102)
    expect(result.similarity_score).toBe(0.91)
    expect(result.confidence_score).toBe(0.94)
  })

  it('normalizes a RELATED match pair', () => {
    const result = toArticleMatch({
      id: 2,
      article_id_1: 101,
      article_id_2: 103,
      match_label: 'RELATED',
      similarity_score: 0.884,
    })
    expect(result.match_label).toBe('RELATED')
  })

  it('normalizes a DIFFERENT match pair', () => {
    const result = toArticleMatch({
      id: 3,
      article_id_1: 101,
      article_id_2: 104,
      match_label: 'DIFFERENT',
      similarity_score: 0.12,
    })
    expect(result.match_label).toBe('DIFFERENT')
  })

  it('throws for invalid match_label', () => {
    expect(() =>
      toArticleMatch({
        id: 5,
        article_id_1: 101,
        article_id_2: 105,
        match_label: 'IDENTICAL',
        similarity_score: 0.9,
      })
    ).toThrow(/Invalid match classification label/)
  })

  it('throws for missing article IDs', () => {
    expect(() =>
      toArticleMatch({ match_label: 'SAME', similarity_score: 0.9 })
    ).toThrow()
  })

  it('normalizes null similarity_score gracefully', () => {
    const result = toArticleMatch({
      id: 4,
      article_id_1: 104,
      article_id_2: 105,
      match_label: 'RELATED',
      similarity_score: null,
    })
    expect(result.similarity_score).toBeNull()
  })

  it('normalizes null review_status to "unreviewed"', () => {
    const result = toArticleMatch({
      id: 4,
      article_id_1: 104,
      article_id_2: 105,
      match_label: 'RELATED',
      review_status: null,
    })
    expect(result.review_status).toBe('unreviewed')
  })

  it('parses nested article_1 / article_2 objects', () => {
    const result = toArticleMatch({
      id: 1,
      article_id_1: 101,
      article_id_2: 102,
      match_label: 'SAME',
      article_1: {
        id: 101,
        title: 'Article Alpha',
        source_name: 'Source One',
        published_at: '2026-10-26T08:30:00Z',
      },
      article_2: {
        id: 102,
        title: 'Article Beta',
        source_name: 'Source Two',
      },
    })
    expect(result.article_a.title).toBe('Article Alpha')
    expect(result.article_a.source_name).toBe('Source One')
    expect(result.article_b.title).toBe('Article Beta')
  })

  it('accepts valid label list from VALID_MATCH_LABELS', () => {
    expect(VALID_MATCH_LABELS).toEqual(['SAME', 'RELATED', 'DIFFERENT'])
  })

  it('normalizes list from plain array', () => {
    const list = [
      { id: 1, article_id_1: 101, article_id_2: 102, match_label: 'SAME' },
      { id: 2, article_id_1: 101, article_id_2: 103, match_label: 'RELATED' },
    ]
    const result = toArticleMatchList(list)
    expect(result).toHaveLength(2)
    expect(result[0].match_label).toBe('SAME')
    expect(result[1].match_label).toBe('RELATED')
  })

  it('normalizes list from object with "matches" key', () => {
    const wrapped = {
      matches: [
        { id: 1, article_id_1: 101, article_id_2: 102, match_label: 'DIFFERENT' },
      ],
    }
    const result = toArticleMatchList(wrapped)
    expect(result[0].match_label).toBe('DIFFERENT')
  })
})
