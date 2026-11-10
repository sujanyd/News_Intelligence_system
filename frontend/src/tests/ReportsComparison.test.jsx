import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import Reports from '../pages/Reports'
import StoryComparison from '../components/StoryComparison'
import ComparisonView from '../components/ComparisonView'
import RssFeedList from '../components/RssFeedList'
import AiDetectionSection from '../components/AiDetectionSection'
import { NavigationContext } from '../navigation'
import {
  createComparison,
  fetchAiDetection,
  fetchAllComparisons,
  fetchAllReports,
  fetchAllStories,
  fetchArticleAnalyses,
  fetchComparisonWithEvent,
  fetchIngestionFeeds,
  fetchPoliticalAnalysis,
  fetchReport,
  fetchStory,
  generateReport,
  rerunAiDetection,
} from '../api/newsApi'
import { toAiDetection, toComparison, toReport } from '../api/normalize'
import { ApiError } from '../api/client'

// Tests run in mock mode, where these features are turned off. Here we turn
// them on and replace the backend calls with fakes.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    STORIES_AVAILABLE: true,
    POLITICAL_AVAILABLE: true,
    INGESTION_AVAILABLE: true,
    COMPARISONS_AVAILABLE: true,
    AI_DETECTION_AVAILABLE: true,
    fetchAllStories: vi.fn(),
    fetchStory: vi.fn(),
    fetchArticleAnalyses: vi.fn(),
    fetchPoliticalAnalysis: vi.fn(),
    fetchIngestionFeeds: vi.fn(),
    fetchAllComparisons: vi.fn(),
    fetchComparisonWithEvent: vi.fn(),
    createComparison: vi.fn(),
    fetchAllReports: vi.fn(),
    fetchReport: vi.fn(),
    generateReport: vi.fn(),
    fetchAiDetection: vi.fn(),
    rerunAiDetection: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Test data only, shaped like the real backend replies (see API_CONTRACT.md)
// ---------------------------------------------------------------------------

const STORY_LIST = [
  { id: 10, title: "Iran's chief negotiator says Americans voted 'no to war'", article_count: 3, event_count: 1, created_at: '2026-11-09T10:00:00' },
  { id: 20, title: 'Single article story', article_count: 1, event_count: 1, created_at: '2026-11-09T10:00:00' },
]

const ARTICLES = [
  { id: 1, source_name: 'BBC News', title: 'Iran says US voters rejected war', published_at: '2026-11-05T10:00:00', url: 'https://bbc.test/1', content_availability: 'summary_only' },
  { id: 2, source_name: 'BBC News', title: 'Second BBC article', published_at: '2026-11-05T12:00:00', url: '', content_availability: 'headline_only' },
  { id: 3, source_name: 'NPR News', title: 'Tehran reacts to midterms', published_at: '2026-11-06T09:00:00', url: '', content_availability: 'summary_only' },
]

const STORY = {
  id: 10,
  title: STORY_LIST[0].title,
  events: [{ id: 5, event_time: '2026-11-05T00:00:00', event_time_precision: 'date', event_time_disagreement: false, article_count: 3 }],
  articles: ARTICLES,
}

function analyses({ entities, frames = [], signals = [], facts = [], tone = 'neutral' }) {
  return {
    insights: { entities, topics: [{ id: 1, name: 'Midterms' }], facts, quotes: [{ id: 9, text: 'We said no.', speaker_name: null }] },
    tone: {
      tone: { label: tone, score: tone === 'critical' ? -0.6 : 0, confidence: 0.8, explanation: null },
      headline_framing: { frames, evidence_phrases: frames.length ? ['war'] : [], primary_frame: frames[0] || null },
      signals,
    },
    political: { entities: [], signals: [] },
    errors: {},
  }
}

const ANALYSES = {
  1: analyses({
    entities: [{ id: 1, name: 'Iran', type: 'LOCATION' }, { id: 2, name: 'Oman', type: 'LOCATION' }],
    frames: ['conflict_emphasis'],
    signals: [{ id: 7, frame_type: 'conflict_emphasis', evidence_text: 'Iran said voters said no to war.', from_headline: false }],
    facts: [{ id: 1, statement: 'Iran commented on the vote.' }],
    tone: 'critical',
  }),
  2: { insights: null, tone: null, political: null, errors: { insights: 'boom', tone: 'boom', political: 'boom' } },
  3: analyses({ entities: [{ id: 3, name: 'iran', type: 'LOCATION' }], facts: [] }),
}

// Shaped like GET /api/comparisons/{id} (seen on the real backend)
const COMPARISON = toComparison({
  id: 4,
  event_id: null,
  title: STORY.title,
  description: '3 articles of story #10 (BBC News, NPR News)',
  status: 'completed',
  article_count: 3,
  created_at: '2026-11-10T09:00:00',
  articles: ARTICLES,
  coverages: [
    { id: 1, comparison_id: 4, article_id: 1, coverage_score: 0.52, tone_score: -0.6, primary_frame: 'conflict_emphasis', omitted_topics: 'tehran', article_title: ARTICLES[0].title, source_name: 'BBC News', created_at: '2026-11-10T09:00:00' },
    { id: 2, comparison_id: 4, article_id: 3, coverage_score: 0.47, tone_score: 0, primary_frame: 'neutral_reporting', omitted_topics: 'No major omissions relative to peers.', article_title: ARTICLES[2].title, source_name: 'NPR News', created_at: '2026-11-10T09:00:00' },
  ],
  evidences: [
    { id: 1, comparison_id: 4, article_id: 1, evidence_type: 'framing_contrast', claim_or_topic: 'Headline Framing Divergence', content: "Framing contrast: BBC News framed coverage via 'conflict_emphasis', whereas NPR News framed via 'neutral_reporting'.", created_at: '2026-11-10T09:00:00' },
  ],
  political_signals: [{ id: 1, article_id: 1, political_leaning: 'center', slant_score: 0 }],
  synthesis_summary: 'Compared 3 articles.',
})

const REPORT = toReport({
  id: 7,
  comparison_id: 4,
  title: `Intelligence Synthesis: ${STORY.title}`,
  summary: 'Cross-media comparative analysis across 3 articles from 2 publishers (BBC News, NPR News).',
  content: '# Intelligence Synthesis\n- **BBC News**: Leaning `center`',
  report_format: 'markdown',
  created_at: '2026-11-10T09:05:00',
})

beforeEach(() => {
  vi.clearAllMocks()
  fetchAllStories.mockResolvedValue({ items: STORY_LIST, isComplete: true })
  fetchStory.mockResolvedValue(STORY)
  fetchArticleAnalyses.mockImplementation(async (id) => ANALYSES[id])
  fetchPoliticalAnalysis.mockResolvedValue({ article_id: null, analyzed_at: null, entities: [], signals: [] })
  fetchAllComparisons.mockResolvedValue({ items: [COMPARISON], isComplete: true })
  fetchComparisonWithEvent.mockResolvedValue({ comparison: COMPARISON, events: [] })
  fetchAllReports.mockResolvedValue({ items: [REPORT], isComplete: true })
  fetchReport.mockResolvedValue(REPORT)
})

describe('toComparison and toReport', () => {
  it('renames the length-based score and leaves out the political leaning', () => {
    expect(COMPARISON.coverages[0].text_length_score).toBe(0.52)
    expect(COMPARISON.coverages[0]).not.toHaveProperty('coverage_score')
    expect(COMPARISON).not.toHaveProperty('political_signals')
    // The backend's "nothing missing" sentence becomes null
    expect(COMPARISON.coverages[1].omitted_topics).toBeNull()
  })

  it('rejects a report without content or comparison', () => {
    expect(() => toReport({ id: 1, title: 'x' })).toThrow('unexpected format')
    expect(REPORT.report_format).toBe('markdown')
  })
})

describe('Reports page', () => {
  it('lists the saved reports', async () => {
    render(<Reports />)
    const table = await screen.findByRole('table', { name: 'Saved reports' })
    expect(within(table).getByText(REPORT.title)).toBeDefined()
    expect(within(table).getByText('#4')).toBeDefined()
  })

  it('opens a report: backend summary, download, plain text, and the analysis with evidence and limitations', async () => {
    render(<Reports />)
    fireEvent.click(await screen.findByRole('button', { name: `Open report 7: ${REPORT.title}` }))

    expect(await screen.findByTestId('report-view')).toBeDefined()
    expect(fetchReport).toHaveBeenCalledWith(7)
    expect(screen.getByText(REPORT.summary)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Download (Markdown)' })).toBeDefined()
    // The backend text is plain text, not HTML
    expect(screen.getByText(/# Intelligence Synthesis/).tagName).toBe('PRE')

    await screen.findByTestId('coverage-analysis')
    expect(fetchComparisonWithEvent).toHaveBeenCalledWith(4)
    expect(within(screen.getByRole('list', { name: 'Publishers' })).getByText('BBC News')).toBeDefined()
    expect(screen.getByRole('table', { name: 'Backend comparison results per article' })).toBeDefined()
    expect(screen.getByText('Different headline framing')).toBeDefined()

    const frames = screen.getByRole('list', { name: 'Framing types used' })
    expect(within(frames).getByText('1 of 3 articles (BBC News)')).toBeDefined()
    expect(screen.getByText('Iran (Location)')).toBeDefined()
    expect(screen.getByText('Oman (Location): BBC News')).toBeDefined()
    expect(within(screen.getByRole('list', { name: 'Facts by article' })).getByText('“Iran commented on the vote.”')).toBeDefined()

    const limits = screen.getByTestId('report-limitations')
    expect(within(limits).getByText(/Tone is not bias/)).toBeDefined()
    expect(within(limits).getByText(/leaning/)).toBeDefined()
    expect(within(limits).getByText(/Some analyses of "Second BBC article" could not be loaded/)).toBeDefined()
  })

  it('still shows the report when its comparison cannot be loaded', async () => {
    fetchComparisonWithEvent.mockRejectedValueOnce(new ApiError('News comparison with ID 4 not found. (HTTP 404)', 404))
    render(<Reports initialReportId={7} />)
    expect(await screen.findByText('The comparison behind this report could not be loaded.')).toBeDefined()
    expect(screen.getByText(REPORT.summary)).toBeDefined()
  })

  it('generates a report from a saved comparison and opens it', async () => {
    generateReport.mockResolvedValue(REPORT)
    render(<Reports />)
    fireEvent.change(await screen.findByLabelText('Comparison'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'json' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    expect(await screen.findByTestId('report-view')).toBeDefined()
    expect(generateReport).toHaveBeenCalledWith({ comparisonId: 4, format: 'json' })
  })

  it('says when there are no reports and no comparisons', async () => {
    fetchAllReports.mockResolvedValue({ items: [], isComplete: true })
    fetchAllComparisons.mockResolvedValue({ items: [], isComplete: true })
    render(<Reports />)
    expect(await screen.findByText('No reports yet')).toBeDefined()
    expect(screen.getByText('No saved comparisons yet')).toBeDefined()
  })

  it('shows the error with "Try again"', async () => {
    fetchAllReports.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<Reports />)
    expect(await screen.findByText('Could not load the reports.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Saved reports' })).toBeDefined()
  })
})

describe('ComparisonView', () => {
  it('shows the articles, backend results and observations, and opens an article', async () => {
    render(<ComparisonView comparisonId={4} onBack={() => {}} />)
    expect(await screen.findByTestId('comparison-view')).toBeDefined()
    const list = screen.getByRole('list', { name: 'Articles being compared' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    const backendTable = screen.getByRole('table', { name: 'Backend comparison results per article' })
    expect(within(backendTable).getByText('Text length score')).toBeDefined()
    // NPR's 'neutral_reporting' means no cue word matched
    expect(within(backendTable).getByText('No cue found')).toBeDefined()
    expect(within(backendTable).getByText('tehran')).toBeDefined()
    expect(screen.getByText(/They are not quotes from the articles/)).toBeDefined()
    // The backend's left/right leaning is never shown as a result
    expect(screen.queryByText('center')).toBeNull()
  })

  it('generates a report and offers to open it', async () => {
    generateReport.mockResolvedValue(REPORT)
    const navigate = vi.fn()
    render(
      <NavigationContext.Provider value={navigate}>
        <ComparisonView comparisonId={4} onBack={() => {}} />
      </NavigationContext.Provider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Generate a report' }))
    expect(await screen.findByText('Report #7 saved.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Open report #7' }))
    expect(navigate).toHaveBeenCalledWith('reports', { reportId: 7 })
  })

  it('shows the error when the comparison cannot be loaded', async () => {
    fetchComparisonWithEvent.mockRejectedValueOnce(new ApiError('News comparison with ID 4 not found. (HTTP 404)', 404))
    render(<ComparisonView comparisonId={4} onBack={() => {}} />)
    expect(await screen.findByText('Could not load the comparison.')).toBeDefined()
  })
})

describe('StoryComparison', () => {
  it('offers only stories with 2 or more articles', async () => {
    render(<StoryComparison />)
    const picker = await screen.findByLabelText('Story')
    const options = within(picker).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Choose a story...', `${STORY_LIST[0].title} (3 articles)`])
  })

  it('compares two publishers: headlines, framing, shared and missing names, facts', async () => {
    render(<StoryComparison />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })

    // Article A = first article, Article B = first article from another publisher
    expect((await screen.findByLabelText('Article A')).value).toBe('1')
    expect(screen.getByLabelText('Article B').value).toBe('3')

    expect(await screen.findByText('Headlines and framing')).toBeDefined()
    expect(screen.getByText('matched: “war”')).toBeDefined()
    expect(screen.getAllByText('Only in BBC News (Article A)', { selector: 'dt' })).toHaveLength(2)
    expect(screen.getByText('“Iran commented on the vote.”')).toBeDefined()
  })

  it('saves the two articles as a backend comparison and opens it', async () => {
    createComparison.mockResolvedValue(COMPARISON)
    const onSaved = vi.fn()
    render(<StoryComparison onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })
    await screen.findByText('Headlines and framing')

    fireEvent.click(screen.getByRole('button', { name: 'Save these two as a comparison' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(4))
    expect(createComparison).toHaveBeenCalledWith({
      title: STORY.title,
      description: '2 articles of story #10 (BBC News, NPR News)',
      articleIds: [1, 3],
    })
  })

  it('saves all articles of the story, and shows a save error', async () => {
    createComparison.mockRejectedValueOnce(new ApiError('A cross-source comparison requires at least 2 distinct articles (found 1). (HTTP 400)', 400))
    render(<StoryComparison onSaved={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })
    await screen.findByText('Headlines and framing')
    fireEvent.click(screen.getByRole('button', { name: 'Save all 3 articles as a comparison' }))
    expect(await screen.findByText('Could not save the comparison.')).toBeDefined()
    expect(createComparison.mock.calls[0][0].articleIds).toEqual([1, 2, 3])
  })

  it('says when both articles come from one publisher', async () => {
    render(<StoryComparison />)
    fireEvent.change(await screen.findByLabelText('Story'), { target: { value: '10' } })
    await screen.findByText('Headlines and framing')
    fireEvent.change(screen.getByLabelText('Article B'), { target: { value: '2' } })
    expect(await screen.findByText(/Both articles are from BBC News/)).toBeDefined()
  })

  it('shows the error with "Try again" when stories cannot load', async () => {
    fetchAllStories.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    render(<StoryComparison />)
    expect(await screen.findByText('Could not load stories.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Story')).toBeDefined()
  })
})

// Shaped like GET /api/articles/{id}/ai-detection (seen on the real backend)
const AI_REPLY = {
  id: 1,
  article_id: 50,
  ai_likelihood: 0.31,
  confidence_score: 0.78,
  model_name: 'statistical-burstiness-entropy-v1',
  model_version: '1.0.0',
  is_flagged_for_review: false,
  metrics: {
    burstiness_score: 0.62,
    lexical_uniformity: 0.41,
    sentence_count: 7,
    average_sentence_length: 21.4,
    repetition_index: 0.02,
    methodology: 'Statistical analysis of sentence pacing variance (burstiness) and vocabulary entropy.',
  },
  interpretation: 'Low probability (31%) of AI generation.',
  limitations: 'AI detection estimates are statistical approximations.',
  created_at: '2026-11-10T09:00:00',
}

describe('AiDetectionSection', () => {
  it('shows the estimate, confidence, detector, measures and limitations', async () => {
    fetchAiDetection.mockResolvedValue(toAiDetection(AI_REPLY))
    render(<AiDetectionSection articleId={50} contentAvailability="summary_only" />)
    expect(await screen.findByText('31%')).toBeDefined()
    expect(screen.getByRole('img', { name: /Estimated AI likelihood 31%/ })).toBeDefined()
    expect(screen.getByText('Low estimate')).toBeDefined()
    expect(screen.getByText('78% (based only on how much text there was)')).toBeDefined()
    expect(screen.getByText('statistical-burstiness-entropy-v1 (version 1.0.0)')).toBeDefined()
    expect(screen.getByText('Only the summary the feed gave')).toBeDefined()
    expect(screen.getByText('21.4 words')).toBeDefined()
    expect(screen.getByText(/not proof/)).toBeDefined()
  })

  it('says "not enough text" instead of showing the backend default', async () => {
    fetchAiDetection.mockResolvedValue(
      toAiDetection({ ...AI_REPLY, ai_likelihood: 0.05, confidence_score: 0.5, metrics: { ...AI_REPLY.metrics, sentence_count: 0 } })
    )
    render(<AiDetectionSection articleId={50} />)
    expect(await screen.findByText('Not enough text to estimate.')).toBeDefined()
    expect(screen.queryByText('5%')).toBeNull()
  })

  it('marks an article flagged for review', async () => {
    fetchAiDetection.mockResolvedValue(toAiDetection({ ...AI_REPLY, ai_likelihood: 0.8, is_flagged_for_review: true }))
    render(<AiDetectionSection articleId={50} />)
    expect(await screen.findByText('Flagged for a human to check')).toBeDefined()
    expect(screen.getByText('High estimate')).toBeDefined()
  })

  it('checks again with the POST route', async () => {
    fetchAiDetection.mockResolvedValue(toAiDetection(AI_REPLY))
    rerunAiDetection.mockResolvedValue(toAiDetection({ ...AI_REPLY, ai_likelihood: 0.4 }))
    render(<AiDetectionSection articleId={50} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Check again' }))
    expect(await screen.findByText('40%')).toBeDefined()
    expect(rerunAiDetection).toHaveBeenCalledWith(50)
  })

  it('shows the error with "Try again"', async () => {
    fetchAiDetection.mockRejectedValueOnce(new ApiError('Article with ID 50 does not exist. (HTTP 404)', 404))
    fetchAiDetection.mockResolvedValueOnce(toAiDetection(AI_REPLY))
    render(<AiDetectionSection articleId={50} />)
    expect(await screen.findByText('Could not load the AI detection estimate.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('31%')).toBeDefined()
  })

  it('rejects a reply without a likelihood', () => {
    expect(() => toAiDetection({ article_id: 1 })).toThrow('unexpected format')
  })
})

describe('RssFeedList', () => {
  it('shows the feeds the news collection reads', async () => {
    fetchIngestionFeeds.mockResolvedValue([
      { source_name: 'NPR News', base_url: 'https://npr.org', feed_url: 'https://feeds.npr.org/1001/rss.xml' },
    ])
    render(<RssFeedList />)
    const table = await screen.findByRole('table', { name: 'RSS feeds read by News Collection' })
    expect(within(table).getByText('NPR News')).toBeDefined()
  })

  it('shows the error with "Try again"', async () => {
    fetchIngestionFeeds.mockRejectedValueOnce(new ApiError('Could not reach the backend at http://backend.test.'))
    fetchIngestionFeeds.mockResolvedValueOnce([])
    render(<RssFeedList />)
    expect(await screen.findByText('Could not load the RSS feeds.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No RSS feeds configured')).toBeDefined()
  })
})
