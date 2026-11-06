import { describe, it, expect, vi, afterEach } from 'vitest'
import { toEvent, toGroupingSummary, toStory } from '../api/normalize'
import { fetchStories } from '../api/newsApi'
import {
  formatEventTime,
  getUniqueSourceNames,
  sortEventsByTime,
} from '../utils/formatEventTime'

// Shaped like the real replies of GET /api/stories/{id} and GET /api/events/{id}
// (see API_CONTRACT.md). Test data only.
const STORY_REPLY = {
  id: 1,
  title: 'Global Clean Energy Summit 2026',
  created_at: '2026-11-05T02:37:03.327629',
  event_count: 1,
  article_count: 1,
  events: [
    {
      id: 1,
      story_id: 1,
      event_time: '2026-10-24T14:30:00',
      event_time_precision: 'exact',
      event_time_disagreement: false,
      article_count: 1,
    },
  ],
  articles: [
    { id: 1, source_id: 1, source_name: 'Reuters', event_id: 1, title: 'Leaders sign pact' },
  ],
}

describe('toStory and toEvent', () => {
  it('keeps the story fields, its events and its articles', () => {
    const story = toStory(STORY_REPLY)
    expect(story.title).toBe('Global Clean Energy Summit 2026')
    expect(story.event_count).toBe(1)
    expect(story.events[0].event_time_precision).toBe('exact')
    expect(story.articles[0].source_name).toBe('Reuters')
  })

  it('accepts a story from the list, which has no events or articles', () => {
    const story = toStory({ id: 2, title: 'Trial', created_at: null, event_count: 0, article_count: 0 })
    expect(story.events).toEqual([])
    expect(story.articles).toEqual([])
  })

  it('rejects a story without an id or title', () => {
    expect(() => toStory({ id: 1 })).toThrow('unexpected format')
    expect(() => toStory({ title: 'No id' })).toThrow('unexpected format')
  })

  it('reads the event extras from GET /events/{id}', () => {
    const event = toEvent({
      ...STORY_REPLY.events[0],
      story_title: 'Global Clean Energy Summit 2026',
      articles: STORY_REPLY.articles,
    })
    expect(event.story_title).toBe('Global Clean Energy Summit 2026')
    expect(event.articles).toHaveLength(1)
  })

  it('treats an unknown precision as "unknown" and a missing time as null', () => {
    const event = toEvent({ id: 3, story_id: 1, event_time_precision: 'about-then' })
    expect(event.event_time_precision).toBe('unknown')
    expect(event.event_time).toBeNull()
    expect(event.event_time_disagreement).toBe(false)
  })

  it('rejects an event without an id', () => {
    expect(() => toEvent({ story_id: 1 })).toThrow('unexpected format')
  })
})

describe('toGroupingSummary', () => {
  it('counts created and reused stories and events', () => {
    const summary = toGroupingSummary([
      { article_id: 1, story_action: 'created', event_action: 'created' },
      { article_id: 2, story_action: 'reused', event_action: 'created' },
      { article_id: 3, story_action: 'reused', event_action: 'reused' },
    ])
    expect(summary).toEqual({
      articlesGrouped: 3,
      storiesCreated: 1,
      storiesReused: 2,
      eventsCreated: 2,
      eventsReused: 1,
    })
  })

  it('rejects a reply that is not a list', () => {
    expect(() => toGroupingSummary({ grouped: 3 })).toThrow('unexpected format')
  })
})

describe('formatEventTime', () => {
  const at = (precision, time = '2026-10-24T14:30:00') => ({
    event_time: time,
    event_time_precision: precision,
  })

  it('shows the date and hour for an exact time', () => {
    const text = formatEventTime(at('exact'))
    expect(text).toContain('2026')
    expect(text).toMatch(/\d:\d\d/)
  })

  it('shows only the date when the hour is not known', () => {
    const text = formatEventTime(at('date'))
    expect(text).toContain('2026')
    expect(text).not.toMatch(/\d:\d\d/)
  })

  it('says "Around" for a range', () => {
    expect(formatEventTime(at('range'))).toMatch(/^Around /)
  })

  it('says "Not known" when the precision is unknown or there is no time', () => {
    expect(formatEventTime(at('unknown'))).toBe('Not known')
    expect(formatEventTime(at('exact', null))).toBe('Not known')
  })
})

describe('story helpers', () => {
  it('lists each source once, from A to Z', () => {
    const names = getUniqueSourceNames([
      { source_name: 'Reuters' },
      { source_name: 'BBC News' },
      { source_name: 'Reuters' },
      { source_name: null },
    ])
    expect(names).toEqual(['BBC News', 'Reuters'])
  })

  it('sorts events from earliest to latest, unknown times last', () => {
    const sorted = sortEventsByTime([
      { id: 1, event_time: '2026-11-04T10:00:00', event_time_precision: 'exact' },
      { id: 2, event_time: null, event_time_precision: 'unknown' },
      { id: 3, event_time: '2026-11-03T10:00:00', event_time_precision: 'date' },
    ])
    expect(sorted.map((event) => event.id)).toEqual([3, 1, 2])
  })
})

describe('story and event requests in mock mode', () => {
  it('refuses instead of showing made-up stories', async () => {
    await expect(fetchStories()).rejects.toThrow('only work with the real backend')
  })
})

describe('story and event requests in live mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadLiveApi() {
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    return import('../api/newsApi')
  }

  function stubFetchJson(body) {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    })
    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
  }

  it('pages the stories list with skip (the backend ignores offset)', async () => {
    const fakeFetch = stubFetchJson([{ id: 1, title: 'A', event_count: 2, article_count: 3 }])
    const api = await loadLiveApi()

    const stories = await api.fetchStories({ limit: 11, skip: 10 })

    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/stories?limit=11&skip=10')
    expect(stories[0].article_count).toBe(3)
  })

  it('loads one story and one event by id', async () => {
    const fakeFetch = stubFetchJson(STORY_REPLY)
    const api = await loadLiveApi()

    await api.fetchStory(1)
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/stories/1')

    stubFetchJson({ ...STORY_REPLY.events[0], story_title: 'X', articles: [] })
    const event = await api.fetchEvent(1)
    expect(fetch.mock.calls[0][0]).toBe('http://backend.test/api/events/1')
    expect(event.story_title).toBe('X')
  })

  it('groups articles with POST /api/stories/group/batch?limit=200', async () => {
    const fakeFetch = stubFetchJson([{ article_id: 7, story_action: 'created', event_action: 'created' }])
    const api = await loadLiveApi()

    const summary = await api.groupArticlesIntoStories()

    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('http://backend.test/api/stories/group/batch?limit=200')
    expect(options.method).toBe('POST')
    expect(summary.storiesCreated).toBe(1)
  })
})

describe('article insights requests', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('refuses in mock mode instead of showing made-up insights', async () => {
    const api = await import('../api/newsApi')
    await expect(api.fetchArticleInsights(1)).rejects.toThrow('only work with the real backend')
  })

  it('uses GET /extraction and POST /extract in live mode', async () => {
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    const api = await import('../api/newsApi')
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 1, status: 'completed', topics: [{ id: 1, topic_name: 'Energy' }] }),
    })
    vi.stubGlobal('fetch', fakeFetch)

    const insights = await api.fetchArticleInsights(7)
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/7/extraction')
    expect(insights.topics[0].name).toBe('Energy')

    await api.rerunArticleInsights(7)
    const [url, options] = fakeFetch.mock.calls[1]
    expect(url).toBe('http://backend.test/api/articles/7/extract')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ force_reanalyze: true })
  })
})
