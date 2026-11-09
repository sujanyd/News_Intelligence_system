import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import PoliticalAnalysisSection from '../components/PoliticalAnalysisSection'
import PoliticalCoverageComparison from '../components/PoliticalCoverageComparison'
import { fetchPoliticalAnalysis } from '../api/newsApi'
import { toPoliticalAnalysis } from '../api/normalize'
import { compareCoverage, formatTechnique } from '../utils/politicalLabels'
import { ApiError } from '../api/client'

// Tests run in mock mode, where political analysis is turned off (there is no
// sample political data). Here we turn it on and replace the call with a fake.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    POLITICAL_AVAILABLE: true,
    fetchPoliticalAnalysis: vi.fn(),
  }
})

// Shaped like real replies of GET /api/articles/{id}/political-signals
// (see API_CONTRACT.md). Test data only.
function makeReply({ articleId, entities = [], signals = [] }) {
  return {
    article_id: articleId,
    headline: `Headline ${articleId}`,
    political_leaning: 'center-left',
    slant_score: -0.33,
    partisanship_score: 0.64,
    confidence_score: 0.85,
    signal_description: 'Coverage exhibits an estimated center-left orientation.',
    political_entities: entities,
    signals,
    analyzed_at: '2026-11-09T10:00:00',
  }
}

const TRUMP = {
  id: 8,
  name: 'Donald Trump',
  entity_type: 'PERSON',
  political_category: 'POLITICIAN',
  ideological_affiliation: 'Republican Party',
  mention_count: 4,
  presentation: 'unfavorable',
}
const SENATE = {
  id: 6,
  name: 'United States Senate',
  entity_type: 'GOVERNMENT',
  political_category: 'POLITICAL_ORGANIZATION',
  ideological_affiliation: null,
  mention_count: 2,
  presentation: 'neutral',
}
const CRITICAL_SIGNAL = {
  entity_name: 'Donald Trump',
  political_category: 'POLITICIAN',
  treatment: 'unfavorable',
  framing_technique: 'harsh_criticism',
  intensity_score: 0.8,
  confidence_score: 0.82,
  evidence_text: 'The plan was condemned by lawmakers from both parties.',
  explanation: "Entity 'Donald Trump' presented unfavorably via cue 'condemned'.",
}

const ANALYSIS_A = toPoliticalAnalysis(
  makeReply({ articleId: 50, entities: [TRUMP, SENATE], signals: [CRITICAL_SIGNAL] })
)
const ANALYSIS_B = toPoliticalAnalysis(
  makeReply({
    articleId: 81,
    entities: [{ ...TRUMP, presentation: 'neutral', mention_count: 1 }, { ...SENATE, id: 3, name: 'Democratic Party', political_category: 'POLITICAL_PARTY' }],
  })
)

describe('toPoliticalAnalysis', () => {
  it('keeps entities and signals with their evidence', () => {
    expect(ANALYSIS_A.entities[0]).toEqual({
      id: 8,
      name: 'Donald Trump',
      political_category: 'POLITICIAN',
      affiliation: 'Republican Party',
      mention_count: 4,
      presentation: 'unfavorable',
    })
    expect(ANALYSIS_A.signals[0].evidence_text).toBe(CRITICAL_SIGNAL.evidence_text)
    expect(ANALYSIS_A.signals[0].framing_technique).toBe('harsh_criticism')
  })

  it('leaves out the leaning, slant and fixed confidence values', () => {
    for (const field of ['political_leaning', 'slant_score', 'partisanship_score', 'confidence_score']) {
      expect(ANALYSIS_A).not.toHaveProperty(field)
    }
    expect(ANALYSIS_A.signals[0]).not.toHaveProperty('confidence_score')
  })

  it('skips signals without evidence and treats unknown values safely', () => {
    const result = toPoliticalAnalysis({
      political_entities: [{ id: 1, name: 'X', political_category: 'ALIEN', presentation: 'glowing' }],
      signals: [{ entity_name: 'X', treatment: 'favorable', evidence_text: '  ' }],
    })
    expect(result.entities[0].political_category).toBeNull()
    expect(result.entities[0].presentation).toBe('neutral')
    expect(result.signals).toEqual([])
  })

  it('rejects a reply that is not an object', () => {
    expect(() => toPoliticalAnalysis([])).toThrow('unexpected format')
  })
})

describe('political label helpers', () => {
  it('turns a technique into words', () => {
    expect(formatTechnique('harsh_criticism')).toBe('Harsh criticism')
    expect(formatTechnique(null)).toBe('Not given')
  })

  it('lines up entities found in both articles, and lists the rest', () => {
    const { shared, onlyA, onlyB } = compareCoverage(ANALYSIS_A, ANALYSIS_B)
    expect(shared.map((row) => row.name)).toEqual(['Donald Trump'])
    expect(shared[0].a.signals).toHaveLength(1)
    expect(shared[0].b.signals).toHaveLength(0)
    expect(onlyA.map((entity) => entity.name)).toEqual(['United States Senate'])
    expect(onlyB.map((entity) => entity.name)).toEqual(['Democratic Party'])
  })
})

describe('PoliticalAnalysisSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPoliticalAnalysis.mockResolvedValue(ANALYSIS_A)
  })

  it('shows loading, then the political entities with type, affiliation and wording', async () => {
    render(<PoliticalAnalysisSection articleId={50} />)
    expect(screen.getByText('Loading political analysis...')).toBeDefined()

    const table = await screen.findByRole('table', { name: 'Political entities in this article' })
    expect(fetchPoliticalAnalysis).toHaveBeenCalledWith(50)
    const trumpRow = within(table).getByText('Donald Trump').closest('tr')
    expect(within(trumpRow).getByText('Politician')).toBeDefined()
    expect(within(trumpRow).getByText('Republican Party')).toBeDefined()
    expect(within(trumpRow).getByText('Critical wording')).toBeDefined()
    const senateRow = within(table).getByText('United States Senate').closest('tr')
    expect(within(senateRow).getByText('Political organization')).toBeDefined()
    expect(within(senateRow).getByText('Not known')).toBeDefined()
    expect(within(senateRow).getByText('No clear signal')).toBeDefined()
  })

  it('shows each signal with its category apart from its evidence', async () => {
    render(<PoliticalAnalysisSection articleId={50} />)
    const signals = await screen.findByRole('list', { name: 'Wording signals' })
    expect(within(signals).getByText('Category: Harsh criticism')).toBeDefined()
    expect(within(signals).getByText('Evidence from the article')).toBeDefined()
    expect(within(signals).getByText(`“${CRITICAL_SIGNAL.evidence_text}”`)).toBeDefined()
    expect(within(signals).getByText(`Why: ${CRITICAL_SIGNAL.explanation}`)).toBeDefined()
  })

  it('never shows a left/right leaning or the fixed confidence numbers', async () => {
    render(<PoliticalAnalysisSection articleId={50} />)
    await screen.findByRole('table', { name: 'Political entities in this article' })
    expect(screen.queryByText(/center-left/i)).toBeNull()
    expect(screen.queryByText(/0\.8[25]|82%|85%/)).toBeNull()
    expect(screen.getByText(/one article says nothing about a publisher/)).toBeDefined()
  })

  it('says when no wording signal was found', async () => {
    fetchPoliticalAnalysis.mockResolvedValue({ ...ANALYSIS_A, signals: [] })
    render(<PoliticalAnalysisSection articleId={50} />)
    expect(await screen.findByText(/No favorable or critical wording was found/)).toBeDefined()
  })

  it('shows an empty state when there are no political entities', async () => {
    fetchPoliticalAnalysis.mockResolvedValue({ ...ANALYSIS_A, entities: [], signals: [] })
    render(<PoliticalAnalysisSection articleId={12} />)
    expect(await screen.findByText('No political entities found')).toBeDefined()
  })

  it('shows the error and loads again with "Try again"', async () => {
    fetchPoliticalAnalysis.mockRejectedValueOnce(new ApiError('Article with ID 50 not found. (HTTP 404)', 404))
    render(<PoliticalAnalysisSection articleId={50} />)
    expect(await screen.findByText('Could not load the political analysis.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Political entities in this article' })).toBeDefined()
  })
})

describe('PoliticalCoverageComparison', () => {
  const ARTICLE_A = { id: 50, source_name: 'The Guardian' }
  const ARTICLE_B = { id: 81, source_name: 'NPR News' }

  beforeEach(() => {
    vi.clearAllMocks()
    fetchPoliticalAnalysis.mockImplementation(async (id) => (id === 50 ? ANALYSIS_A : ANALYSIS_B))
  })

  it('shows how each article words an entity they share, with evidence', async () => {
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(screen.getByText('Loading political analysis of both articles...')).toBeDefined()

    const row = (await screen.findByText('Donald Trump')).closest('.pol-compare-row')
    expect(within(row).getByText('The Guardian (Article A)')).toBeDefined()
    expect(within(row).getByText('NPR News (Article B)')).toBeDefined()
    // Article A: the entity's badge and its one signal's badge
    expect(within(row).getAllByText('Critical wording')).toHaveLength(2)
    expect(within(row).getByText('No clear signal')).toBeDefined()
    expect(within(row).getByText(`“${CRITICAL_SIGNAL.evidence_text}”`)).toBeDefined()
    expect(within(row).getByText('No favorable or critical wording found.')).toBeDefined()
  })

  it('lists entities named in only one article', async () => {
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(await screen.findByText('Only in The Guardian (Article A)')).toBeDefined()
    expect(screen.getByText('United States Senate')).toBeDefined()
    expect(screen.getByText('Democratic Party')).toBeDefined()
    expect(screen.getByText(/compares two articles, not two publishers/)).toBeDefined()
  })

  it('says when no entity is named in both', async () => {
    fetchPoliticalAnalysis.mockImplementation(async (id) =>
      id === 50 ? ANALYSIS_A : { ...ANALYSIS_B, entities: [ANALYSIS_B.entities[1]] }
    )
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(await screen.findByText('No political entity is named in both articles.')).toBeDefined()
  })

  it('shows an empty state when neither article names a political entity', async () => {
    fetchPoliticalAnalysis.mockResolvedValue({ ...ANALYSIS_A, entities: [], signals: [] })
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(await screen.findByText('No political entities in either article')).toBeDefined()
  })

  it('warns when only one article could be analysed', async () => {
    fetchPoliticalAnalysis.mockImplementation(async (id) => {
      if (id === 81) throw new ApiError('Political signal analysis failed: boom (HTTP 500)', 500)
      return ANALYSIS_A
    })
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(await screen.findByText('Only one article could be analysed.')).toBeDefined()
    expect(screen.getByText(/NPR News \(Article B\) could not be loaded/)).toBeDefined()
  })

  it('shows the error with "Try again" when both fail', async () => {
    fetchPoliticalAnalysis.mockRejectedValue(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<PoliticalCoverageComparison articleA={ARTICLE_A} articleB={ARTICLE_B} />)
    expect(await screen.findByText('Could not load the political analysis.')).toBeDefined()

    fetchPoliticalAnalysis.mockImplementation(async (id) => (id === 50 ? ANALYSIS_A : ANALYSIS_B))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Donald Trump')).toBeDefined()
  })
})

describe('political analysis request', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('makes sure the extraction ran, then uses GET /political-signals in live mode', async () => {
    vi.doUnmock('../api/newsApi')
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    const api = await import('../api/newsApi')
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(makeReply({ articleId: 7, entities: [TRUMP] })),
    })
    vi.stubGlobal('fetch', fakeFetch)

    const analysis = await api.fetchPoliticalAnalysis(7)
    // Extraction first, so the political analysis cannot hide the article's insights
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/7/extraction')
    expect(fakeFetch.mock.calls[1][0]).toBe('http://backend.test/api/articles/7/political-signals')
    expect(analysis.entities[0].name).toBe('Donald Trump')
  })

  it('still loads the political analysis when the extraction request fails', async () => {
    vi.doUnmock('../api/newsApi')
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    const api = await import('../api/newsApi')
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{"detail":"boom"}' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(makeReply({ articleId: 7, entities: [TRUMP] })),
      })
    vi.stubGlobal('fetch', fakeFetch)

    const analysis = await api.fetchPoliticalAnalysis(7)
    expect(analysis.entities).toHaveLength(1)
  })
})
