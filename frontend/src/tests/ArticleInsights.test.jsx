import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import ArticleInsightsSection from '../components/ArticleInsightsSection'
import { fetchArticleInsights, rerunArticleInsights } from '../api/newsApi'
import { toArticleInsights } from '../api/normalize'
import { formatEntityType, groupEntities } from '../utils/groupEntities'
import { ApiError } from '../api/client'

// Tests run in mock mode, where insights are turned off (there are no sample
// insights). Here we turn them on and replace the two calls with fakes.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    INSIGHTS_AVAILABLE: true,
    fetchArticleInsights: vi.fn(),
    rerunArticleInsights: vi.fn(),
  }
})

// Shaped like a real reply of GET /api/articles/{id}/extraction
// (see API_CONTRACT.md). Test data only.
const EXTRACTION_REPLY = {
  id: 2,
  article_id: 40,
  pipeline_version: 'content-extract-v1.0',
  status: 'completed',
  bias_label: 'center',
  sentiment_label: 'neutral',
  created_at: '2026-11-06T10:00:00',
  topics: [
    { id: 11, analysis_id: 2, topic_name: 'Jesse Baird', relevance_score: 0.65 },
    { id: 10, analysis_id: 2, topic_name: 'Beau Lamarre Condon Trial', relevance_score: 0.95, evidence_text: 'trial live updates' },
  ],
  entities: [
    { id: 21, analysis_id: 2, entity_id: 5, entity_name: 'Jesse Baird', entity_type: 'PERSON', mention_count: 3, role: 'subject' },
    { id: 22, analysis_id: 2, entity_id: 6, entity_name: 'NSW Police', entity_type: 'ORGANIZATION', mention_count: 1 },
    { id: 23, analysis_id: 2, entity_id: 7, entity_name: 'Sydney', entity_type: 'LOCATION', mention_count: 2 },
    { id: 24, analysis_id: 2, entity_id: 8, entity_name: 'Climate Policy', entity_type: 'CONCEPT', mention_count: 1 },
  ],
  facts: [
    { id: 31, analysis_id: 2, fact_statement: 'The 31-year-old is accused of two murders.', verification_status: 'unverified', confidence_score: 0.95 },
  ],
  quotes: [
    { id: 41, analysis_id: 2, quote_text: 'I have seen a lot of things.', speaker_name: 'Beau Lamarre-Condon', speaker_title: 'Former constable', is_opinion: true },
    { id: 42, analysis_id: 2, quote_text: 'Nobody saw it coming.', speaker_name: null, speaker_title: null, is_opinion: true },
  ],
}

const INSIGHTS = toArticleInsights(EXTRACTION_REPLY)
const EMPTY_INSIGHTS = toArticleInsights({ id: 3, status: 'completed', topics: [], entities: [], facts: [], quotes: [] })

describe('toArticleInsights', () => {
  it('keeps topics, entities, facts and quotes with their details', () => {
    expect(INSIGHTS.topics.map((topic) => topic.name)).toEqual(['Jesse Baird', 'Beau Lamarre Condon Trial'])
    expect(INSIGHTS.entities[0]).toEqual({
      id: 21,
      name: 'Jesse Baird',
      type: 'PERSON',
      mention_count: 3,
      salience_score: null,
      role: 'subject',
    })
    expect(INSIGHTS.facts[0].verification_status).toBe('unverified')
    expect(INSIGHTS.quotes[1].speaker_name).toBeNull()
    expect(INSIGHTS.pipeline_version).toBe('content-extract-v1.0')
  })

  it('leaves out the fixed bias and sentiment values', () => {
    expect(INSIGHTS).not.toHaveProperty('bias_label')
    expect(INSIGHTS).not.toHaveProperty('sentiment_label')
  })

  it('treats missing lists as empty and skips items without text', () => {
    const result = toArticleInsights({
      id: 5,
      topics: [{ id: 1, topic_name: '   ' }, { id: 2, topic_name: 'Budget' }],
      quotes: [{ id: 3 }],
    })
    expect(result.topics).toHaveLength(1)
    expect(result.entities).toEqual([])
    expect(result.facts).toEqual([])
    expect(result.quotes).toEqual([])
  })

  it('rejects a reply that is not an object', () => {
    expect(() => toArticleInsights([])).toThrow('unexpected format')
    expect(() => toArticleInsights(null)).toThrow('unexpected format')
  })
})

describe('groupEntities', () => {
  it('groups people, organizations, locations and other types, most mentioned first', () => {
    const groups = groupEntities([
      { id: 1, name: 'A', type: 'PERSON', mention_count: 1 },
      { id: 2, name: 'B', type: 'PERSON', mention_count: 4 },
      { id: 3, name: 'C', type: 'CONCEPT', mention_count: 1 },
    ])
    expect(groups.map((group) => group.label)).toEqual(['People', 'Other'])
    expect(groups[0].entities.map((entity) => entity.name)).toEqual(['B', 'A'])
  })

  it('turns a type into readable words', () => {
    expect(formatEntityType('CONCEPT')).toBe('Concept')
    expect(formatEntityType('WORK_OF_ART')).toBe('Work of art')
  })
})

describe('ArticleInsightsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchArticleInsights.mockResolvedValue(INSIGHTS)
  })

  it('shows loading, then the topics (most relevant first)', async () => {
    render(<ArticleInsightsSection articleId={40} contentAvailability="summary_only" />)
    expect(screen.getByText(/Loading insights/)).toBeDefined()

    const topics = await screen.findByRole('list', { name: 'Topics' })
    expect(fetchArticleInsights).toHaveBeenCalledWith(40)
    const names = within(topics).getAllByRole('listitem').map((item) => item.textContent)
    expect(names).toEqual(['Beau Lamarre Condon Trial', 'Jesse Baird'])
  })

  it('shows the entities in groups by type, with mention counts', async () => {
    render(<ArticleInsightsSection articleId={40} />)
    expect(await screen.findByRole('list', { name: 'People' })).toBeDefined()
    expect(within(screen.getByRole('list', { name: 'People' })).getByText(/Jesse Baird/).textContent)
      .toBe('Jesse Baird · 3 mentions')
    expect(within(screen.getByRole('list', { name: 'Organizations' })).getByText('NSW Police')).toBeDefined()
    expect(within(screen.getByRole('list', { name: 'Locations' })).getByText(/Sydney/)).toBeDefined()
    expect(within(screen.getByRole('list', { name: 'Other' })).getByText(/Climate Policy/).textContent)
      .toBe('Climate Policy · Concept')
  })

  it('shows the facts with their check status', async () => {
    render(<ArticleInsightsSection articleId={40} />)
    const facts = await screen.findByRole('list', { name: 'Facts' })
    expect(within(facts).getByText('The 31-year-old is accused of two murders.')).toBeDefined()
    expect(within(facts).getByText('Not checked')).toBeDefined()
  })

  it('shows the quotes with the speaker, or says the speaker is unknown', async () => {
    render(<ArticleInsightsSection articleId={40} />)
    expect(await screen.findByText('“I have seen a lot of things.”')).toBeDefined()
    expect(screen.getByText('— Beau Lamarre-Condon, Former constable')).toBeDefined()
    expect(screen.getByText('— Speaker not identified')).toBeDefined()
  })

  it('never shows the fixed bias or sentiment labels', async () => {
    render(<ArticleInsightsSection articleId={40} />)
    await screen.findByRole('list', { name: 'Topics' })
    expect(screen.queryByText(/center/i)).toBeNull()
    expect(screen.queryByText(/neutral/i)).toBeNull()
  })

  it('says which parts are empty', async () => {
    fetchArticleInsights.mockResolvedValue({ ...INSIGHTS, facts: [], quotes: [] })
    render(<ArticleInsightsSection articleId={40} />)
    expect(await screen.findByText('No factual statements found.')).toBeDefined()
    expect(screen.getByText('No quotes found.')).toBeDefined()
  })

  it('shows an empty state when nothing was found', async () => {
    fetchArticleInsights.mockResolvedValue(EMPTY_INSIGHTS)
    render(<ArticleInsightsSection articleId={40} contentAvailability="headline_only" />)
    expect(await screen.findByText('No insights found')).toBeDefined()
    expect(screen.getByText(/Only the headline was collected/)).toBeDefined()
  })

  it('warns when the analysis is not complete', async () => {
    fetchArticleInsights.mockResolvedValue({ ...INSIGHTS, status: 'failed' })
    render(<ArticleInsightsSection articleId={40} />)
    expect(await screen.findByText('The analysis is not complete.')).toBeDefined()
  })

  it('shows the error and loads again with "Try again"', async () => {
    fetchArticleInsights.mockRejectedValueOnce(new ApiError('Article with ID 40 not found. (HTTP 404)', 404))
    render(<ArticleInsightsSection articleId={40} />)
    expect(await screen.findByText('Could not load the insights.')).toBeDefined()
    expect(screen.getByText('Article with ID 40 not found. (HTTP 404)')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('list', { name: 'Topics' })).toBeDefined()
    expect(fetchArticleInsights).toHaveBeenCalledTimes(2)
  })

  it('"Analyse again" shows the new result', async () => {
    rerunArticleInsights.mockResolvedValue({ ...INSIGHTS, topics: [{ id: 99, name: 'Fresh topic', relevance_score: 0.9, evidence_text: null }] })
    render(<ArticleInsightsSection articleId={40} />)
    await screen.findByRole('list', { name: 'Topics' })

    fireEvent.click(screen.getByRole('button', { name: 'Analyse again' }))
    expect(screen.getByRole('button', { name: 'Analysing...' }).disabled).toBe(true)
    expect(await screen.findByText('Fresh topic')).toBeDefined()
    expect(rerunArticleInsights).toHaveBeenCalledWith(40)
  })

  it('keeps the old result and shows the error when "Analyse again" fails', async () => {
    rerunArticleInsights.mockRejectedValue(new ApiError('Content extraction failed: boom (HTTP 500)', 500))
    render(<ArticleInsightsSection articleId={40} />)
    await screen.findByRole('list', { name: 'Topics' })

    fireEvent.click(screen.getByRole('button', { name: 'Analyse again' }))
    expect(await screen.findByText('Could not analyse the article again.')).toBeDefined()
    expect(screen.getByRole('list', { name: 'Topics' })).toBeDefined()
  })
})
