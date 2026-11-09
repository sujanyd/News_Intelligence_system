import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  compareByName,
  dateRangeOf,
  entityCoverage,
  framesOf,
  groupFrames,
  pickDefaultPair,
  publishersOf,
} from '../utils/coverage'
import { toFeed } from '../api/normalize'

const BBC = { id: 1, source_name: 'BBC News', published_at: '2026-11-05T10:00:00' }
const BBC_2 = { id: 2, source_name: 'BBC News', published_at: '2026-11-04T09:00:00' }
const NPR = { id: 3, source_name: 'NPR News', published_at: null }

// Shaped like the output of toArticleInsights / toToneFraming (test data only)
function analysesWith({ entities = [], headlineFrames = [], signalFrames = [] } = {}) {
  return {
    insights: { entities, topics: [], facts: [], quotes: [] },
    tone: {
      headline_framing: { frames: headlineFrames, evidence_phrases: [] },
      signals: signalFrames.map((frame, index) => ({ id: index, frame_type: frame })),
    },
    political: null,
    errors: {},
  }
}

describe('compareByName', () => {
  it('finds shared names without minding case and spaces', () => {
    const result = compareByName(
      [{ name: 'Iran' }, { name: 'United States' }],
      [{ name: ' iran' }, { name: 'Oman' }]
    )
    expect(result.shared.map((row) => row.name)).toEqual(['Iran'])
    expect(result.onlyA.map((item) => item.name)).toEqual(['United States'])
    expect(result.onlyB.map((item) => item.name)).toEqual(['Oman'])
  })
})

describe('pickDefaultPair', () => {
  it('prefers two different publishers', () => {
    expect(pickDefaultPair([BBC, BBC_2, NPR]).map((article) => article.id)).toEqual([1, 3])
  })

  it('takes the first two when one publisher wrote them all, and needs two articles', () => {
    expect(pickDefaultPair([BBC, BBC_2]).map((article) => article.id)).toEqual([1, 2])
    expect(pickDefaultPair([BBC])).toBeNull()
  })
})

describe('framing helpers', () => {
  it('lists the frames of an article once each', () => {
    const analyses = analysesWith({ headlineFrames: ['blame_attribution'], signalFrames: ['blame_attribution', 'urgency'] })
    expect(framesOf(analyses.tone)).toEqual(['blame_attribution', 'urgency'])
    expect(framesOf(null)).toEqual([])
  })

  it('says which articles use each frame, most used first', () => {
    const groups = groupFrames([
      { article: BBC, analyses: analysesWith({ signalFrames: ['urgency'] }) },
      { article: NPR, analyses: analysesWith({ headlineFrames: ['conflict_emphasis'], signalFrames: ['urgency'] }) },
    ])
    expect(groups[0].frame).toBe('urgency')
    expect(groups[0].articles.map((article) => article.id)).toEqual([1, 3])
    expect(groups[1].articles.map((article) => article.id)).toEqual([3])
  })
})

describe('entityCoverage', () => {
  it('splits names into "named by every article" and "named by some"', () => {
    const result = entityCoverage([
      { article: BBC, analyses: analysesWith({ entities: [{ name: 'Iran', type: 'LOCATION' }, { name: 'Oman', type: 'LOCATION' }] }) },
      { article: NPR, analyses: analysesWith({ entities: [{ name: 'iran', type: 'LOCATION' }] }) },
      { article: BBC_2, analyses: { insights: null, tone: null, political: null, errors: { insights: 'boom' } } },
    ])
    expect(result.analysedCount).toBe(2)
    expect(result.inAll.map((row) => row.name)).toEqual(['Iran'])
    expect(result.inSome.map((row) => row.name)).toEqual(['Oman'])
  })

  it('never says "named by every article" with only one article', () => {
    const result = entityCoverage([{ article: BBC, analyses: analysesWith({ entities: [{ name: 'Iran' }] }) }])
    expect(result.inAll).toEqual([])
  })
})

describe('publishersOf and dateRangeOf', () => {
  it('counts articles per publisher', () => {
    expect(publishersOf([BBC, NPR, BBC_2])).toEqual([
      { name: 'BBC News', count: 2 },
      { name: 'NPR News', count: 1 },
    ])
  })

  it('finds the first and last publication dates, skipping missing ones', () => {
    expect(dateRangeOf([BBC, NPR, BBC_2])).toEqual({ first: BBC_2.published_at, last: BBC.published_at })
    expect(dateRangeOf([NPR])).toBeNull()
  })
})

describe('toFeed', () => {
  it('keeps the feed fields and rejects a feed without a name', () => {
    expect(toFeed({ source_name: 'BBC News', base_url: 'https://bbc.com', feed_url: 'https://bbc.com/rss' })).toEqual({
      source_name: 'BBC News',
      base_url: 'https://bbc.com',
      feed_url: 'https://bbc.com/rss',
    })
    expect(() => toFeed({ feed_url: 'x' })).toThrow('unexpected format')
  })
})

describe('totals and lists (live mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadLiveApi(fakeFetch) {
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    vi.stubGlobal('fetch', fakeFetch)
    return import('../api/newsApi')
  }

  function okReply(body) {
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }

  const article = (id) => ({ id, title: `Article ${id}` })

  it('counts articles by reading pages of 100 until a short page', async () => {
    const fakeFetch = vi.fn(async (url) => {
      const offset = Number(new URL(url).searchParams.get('offset'))
      const size = offset === 0 ? 100 : 30
      return okReply(Array.from({ length: size }, (_, index) => article(offset + index + 1)))
    })
    const api = await loadLiveApi(fakeFetch)

    expect(await api.countArticles()).toEqual({ count: 130, isComplete: true })
    expect(fakeFetch).toHaveBeenCalledTimes(2)
    expect(fakeFetch.mock.calls[1][0]).toContain('offset=100')
  })

  it('stops after 20 pages and says the count is not complete', async () => {
    const fakeFetch = vi.fn(async () => okReply(Array.from({ length: 100 }, (_, index) => article(index + 1))))
    const api = await loadLiveApi(fakeFetch)
    expect(await api.countArticles()).toEqual({ count: 2000, isComplete: false })
  })

  it('counts events with GET /events and skip', async () => {
    const fakeFetch = vi.fn(async () => okReply([{ id: 1 }, { id: 2 }]))
    const api = await loadLiveApi(fakeFetch)
    expect(await api.countEvents()).toEqual({ count: 2, isComplete: true })
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/events?limit=100&skip=0')
  })

  it('loads the RSS feeds from GET /ingestion/feeds', async () => {
    const fakeFetch = vi.fn(async () => okReply([{ source_name: 'NPR News', base_url: 'https://npr.org', feed_url: 'https://feeds.npr.org/1001/rss.xml' }]))
    const api = await loadLiveApi(fakeFetch)
    const feeds = await api.fetchIngestionFeeds()
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/ingestion/feeds')
    expect(feeds[0].source_name).toBe('NPR News')
  })

  it('returns the analyses that loaded, and the errors of those that failed', async () => {
    const fakeFetch = vi.fn(async (url) => {
      if (url.endsWith('/extraction')) return okReply({ id: 1, topics: [{ id: 1, topic_name: 'Elections' }] })
      if (url.endsWith('/tone-framing')) return { ok: false, status: 500, text: async () => '{"detail":"Tone failed"}' }
      return okReply({ political_entities: [], signals: [] })
    })
    const api = await loadLiveApi(fakeFetch)

    const result = await api.fetchArticleAnalyses(4)
    expect(result.insights.topics[0].name).toBe('Elections')
    expect(result.tone).toBeNull()
    expect(result.errors.tone).toContain('Tone failed')
    expect(result.political.entities).toEqual([])
  })
})
