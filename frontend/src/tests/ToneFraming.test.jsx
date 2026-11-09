import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import ToneFramingSection from '../components/ToneFramingSection'
import { fetchToneFraming } from '../api/newsApi'
import { toToneFraming } from '../api/normalize'
import { formatToneScore, frameInfo, toneInfo } from '../utils/toneLabels'
import { ApiError } from '../api/client'

// Tests run in mock mode, where tone and framing are turned off (there is no
// sample data). Here we turn them on and replace the call with a fake.
vi.mock('../api/newsApi', async (importOriginal) => {
  const realModule = await importOriginal()
  return {
    ...realModule,
    TONE_AVAILABLE: true,
    fetchToneFraming: vi.fn(),
  }
})

const HEADLINE = "'This is a disaster': Angry Republicans blame Trump for midterms defeat"

// Shaped like a real reply of GET /api/articles/2/tone-framing (see
// API_CONTRACT.md). Test data only.
const REPLY = {
  article_id: 2,
  analysis_id: 3,
  headline: HEADLINE,
  tone: {
    article_id: 2,
    analysis_id: 3,
    tone: 'alarming',
    tone_score: -0.8,
    confidence: 0.76,
    explanation: "Tone categorized as 'alarming' due to prominent crisis/danger vocabulary (1 alarming occurrences).",
    subjectivity_score: 0.27,
  },
  headline_framing: {
    article_id: 2,
    headline: HEADLINE,
    primary_frame: 'blame_attribution',
    detected_frames: ['blame_attribution', 'emotional_language'],
    confidence: 0.9,
    evidence_phrases: ['blame', 'disaster'],
    explanation: "Headline exhibits 'blame_attribution' framing.",
  },
  framing_signals: [
    {
      id: 3,
      analysis_id: 3,
      frame_type: 'blame_attribution',
      intensity_score: 0.85,
      evidence_text: HEADLINE,
      start_char: 0,
      end_char: 71,
      explanation: "Headline cue 'blame': Attributes culpability, fault, or responsibility for adverse outcomes.",
      created_at: '2026-11-09T03:23:56',
    },
    {
      id: 4,
      analysis_id: 3,
      frame_type: 'conflict_emphasis',
      intensity_score: 0.85,
      evidence_text: 'Party leaders clash over who is to blame.',
      start_char: 120,
      end_char: 161,
      explanation: "Text cue 'clash': Emphasizes dispute, confrontation, or adversarial division.",
      created_at: '2026-11-09T03:23:56',
    },
  ],
  total_signals_count: 2,
  summary: "Article tone assessed as 'alarming'.",
}

// What the backend sends when no cue word matched
const NEUTRAL_REPLY = {
  article_id: 9,
  headline: 'Council meets on Tuesday',
  tone: { tone: 'neutral', tone_score: 0, confidence: 0.88, explanation: "Tone evaluated as 'neutral'." },
  headline_framing: {
    primary_frame: 'neutral_reporting',
    detected_frames: ['neutral_reporting'],
    confidence: 0.85,
    evidence_phrases: [],
    explanation: 'Headline employs objective, descriptive framing.',
  },
  framing_signals: [],
}

const ANALYSIS = toToneFraming(REPLY)

describe('toToneFraming', () => {
  it('keeps the tone, headline framing and signals', () => {
    expect(ANALYSIS.tone).toEqual({
      label: 'alarming',
      score: -0.8,
      confidence: 0.76,
      explanation: REPLY.tone.explanation,
    })
    expect(ANALYSIS.headline_framing.frames).toEqual(['blame_attribution', 'emotional_language'])
    expect(ANALYSIS.headline_framing.evidence_phrases).toEqual(['blame', 'disaster'])
    expect(ANALYSIS.signals).toHaveLength(2)
  })

  it('marks the signal that is the headline itself', () => {
    expect(ANALYSIS.signals[0].from_headline).toBe(true)
    expect(ANALYSIS.signals[1].from_headline).toBe(false)
  })

  it('leaves out the fixed intensity and the repeated summary', () => {
    expect(ANALYSIS.signals[0]).not.toHaveProperty('intensity_score')
    expect(ANALYSIS).not.toHaveProperty('summary')
  })

  it('treats "neutral_reporting" as no framing found', () => {
    expect(toToneFraming(NEUTRAL_REPLY).headline_framing.frames).toEqual([])
  })

  it('does not trust unknown tones or scores out of range', () => {
    const result = toToneFraming({ tone: { tone: 'furious', tone_score: 5, confidence: 2 } })
    expect(result.tone.label).toBeNull()
    expect(result.tone.score).toBeNull()
    expect(result.tone.confidence).toBeNull()
    expect(result.signals).toEqual([])
  })

  it('skips signals without evidence and rejects a reply that is not an object', () => {
    expect(toToneFraming({ framing_signals: [{ id: 1, frame_type: 'urgency' }] }).signals).toEqual([])
    expect(() => toToneFraming(null)).toThrow('unexpected format')
  })
})

describe('tone labels', () => {
  it('gives every tone and frame a plain label', () => {
    expect(toneInfo('critical').label).toBe('Critical')
    expect(toneInfo('something').label).toBe('Not given')
    expect(frameInfo('blame_attribution').label).toBe('Blame')
    expect(frameInfo('new_frame_type').label).toBe('New frame type')
  })

  it('writes the tone score with its sign', () => {
    expect(formatToneScore(-0.8)).toBe('−0.80')
    expect(formatToneScore(0.35)).toBe('+0.35')
    expect(formatToneScore(0)).toBe('0.00')
    expect(formatToneScore(null)).toBe('Not given')
  })
})

describe('ToneFramingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchToneFraming.mockResolvedValue(ANALYSIS)
  })

  it('shows loading, then the tone with its score and confidence', async () => {
    render(<ToneFramingSection articleId={2} />)
    expect(screen.getByText(/Loading tone and framing/)).toBeDefined()

    const tone = await screen.findByTestId('tone-block')
    expect(fetchToneFraming).toHaveBeenCalledWith(2)
    expect(within(tone).getByText('Alarming')).toBeDefined()
    expect(within(tone).getByText('−0.80')).toBeDefined()
    expect(within(tone).getByText('76%')).toBeDefined()
    expect(within(tone).getByRole('img', { name: /Tone score −0.80/ })).toBeDefined()
  })

  it('shows the headline framing types and the words that matched', async () => {
    render(<ToneFramingSection articleId={2} />)
    const block = await screen.findByTestId('headline-framing-block')
    const types = within(block).getByRole('list', { name: 'Headline framing types' })
    expect(within(types).getByText('Blame')).toBeDefined()
    expect(within(types).getByText('Emotional language')).toBeDefined()
    const words = within(block).getByRole('list', { name: 'Headline evidence words' })
    expect(within(words).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '“blame”',
      '“disaster”',
    ])
  })

  it('shows each framing signal with its category apart from its evidence', async () => {
    render(<ToneFramingSection articleId={2} />)
    const list = await screen.findByRole('list', { name: 'Framing signals' })
    const items = within(list).getAllByRole('listitem')
    expect(within(items[0]).getByText('Found in the headline')).toBeDefined()
    expect(within(items[1]).getByText('Conflict')).toBeDefined()
    expect(within(items[1]).getByText('Found in the article text')).toBeDefined()
    expect(within(items[1]).getByText('“Party leaders clash over who is to blame.”')).toBeDefined()
    expect(within(items[1]).getByText(/^Why: Text cue 'clash'/)).toBeDefined()
  })

  it('says when nothing was found, without calling it balanced', async () => {
    fetchToneFraming.mockResolvedValue(toToneFraming(NEUTRAL_REPLY))
    render(<ToneFramingSection articleId={9} />)
    expect(await screen.findByText('Neutral')).toBeDefined()
    expect(screen.getByText(/No framing cue was found in the headline/)).toBeDefined()
    expect(screen.getByText(/No framing signals were found in the text/)).toBeDefined()
  })

  it('says that tone is not bias', async () => {
    render(<ToneFramingSection articleId={2} />)
    await screen.findByTestId('tone-block')
    expect(screen.getByText(/Tone is not bias/)).toBeDefined()
  })

  it('says when only the headline was analysed', async () => {
    render(<ToneFramingSection articleId={2} contentAvailability="headline_only" />)
    expect(await screen.findByText(/only the headline was analysed/)).toBeDefined()
  })

  it('shows the error and loads again with "Try again"', async () => {
    fetchToneFraming.mockRejectedValueOnce(new ApiError('Article with ID 2 does not exist. (HTTP 404)', 404))
    render(<ToneFramingSection articleId={2} />)
    expect(await screen.findByText('Could not load the tone and framing analysis.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('tone-block')).toBeDefined()
    expect(fetchToneFraming).toHaveBeenCalledTimes(2)
  })
})

describe('tone and framing request', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadLiveApi(fakeFetch) {
    vi.doUnmock('../api/newsApi')
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    vi.stubGlobal('fetch', fakeFetch)
    return import('../api/newsApi')
  }

  function okReply(body) {
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }

  it('makes sure the extraction ran, then uses GET /tone-framing', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(okReply(REPLY))
    const api = await loadLiveApi(fakeFetch)

    const analysis = await api.fetchToneFraming(2)
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/2/extraction')
    expect(fakeFetch.mock.calls[1][0]).toBe('http://backend.test/api/articles/2/tone-framing')
    expect(analysis.tone.label).toBe('alarming')
  })

  it('still loads tone and framing when the extraction request fails', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{"detail":"boom"}' })
      .mockResolvedValueOnce(okReply(REPLY))
    const api = await loadLiveApi(fakeFetch)

    const analysis = await api.fetchToneFraming(2)
    expect(analysis.signals).toHaveLength(2)
  })

  it('sends one extraction request when the three sections load together', async () => {
    const fakeFetch = vi.fn(async (url) => {
      if (url.endsWith('/extraction')) return okReply({ id: 1, topics: [] })
      if (url.endsWith('/tone-framing')) return okReply(REPLY)
      return okReply({ political_entities: [], signals: [] })
    })
    const api = await loadLiveApi(fakeFetch)

    await Promise.all([
      api.fetchArticleInsights(2),
      api.fetchPoliticalAnalysis(2),
      api.fetchToneFraming(2),
    ])
    const urls = fakeFetch.mock.calls.map((call) => call[0])
    expect(urls.filter((url) => url.endsWith('/extraction'))).toHaveLength(1)
    expect(urls).toHaveLength(3)
  })
})
