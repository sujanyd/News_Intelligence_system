import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateSourceForm } from '../utils/validateSource'
import { formatDate } from '../utils/formatDate'

describe('validateSourceForm', () => {
  it('returns no errors for a valid source', () => {
    expect(validateSourceForm({ name: 'Daily Ledger', baseUrl: 'https://dailyledger.example' }))
      .toEqual({})
  })

  it('needs a name and a base URL', () => {
    const errors = validateSourceForm({ name: '   ', baseUrl: '' })
    expect(errors.name).toBe('Source name is required.')
    expect(errors.baseUrl).toBe('Base URL is required.')
  })

  it('needs the base URL to start with http:// or https://', () => {
    const errors = validateSourceForm({ name: 'Daily Ledger', baseUrl: 'ftp://dailyledger.example' })
    expect(errors.baseUrl).toBe('Base URL must start with http:// or https://')
  })
})

describe('formatDate', () => {
  it('says "Not available" when there is no date', () => {
    expect(formatDate(null)).toBe('Not available')
  })

  it('includes the year for a real date', () => {
    expect(formatDate('2026-10-26T08:30:00Z')).toContain('2026')
  })
})

describe('newsApi in live mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  // Load a fresh copy of newsApi that talks to the (pretend) real backend
  async function loadLiveApi(prefix = '/api') {
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.stubEnv('VITE_API_PREFIX', prefix)
    vi.resetModules()
    return import('../api/newsApi')
  }

  // Replace fetch() with one that always answers with this JSON
  function stubFetchJson(status, body) {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    })
    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
  }

  it('is in live mode and uses the planned paths', async () => {
    const api = await loadLiveApi()
    expect(api.USE_MOCK_DATA).toBe(false)
    expect(api.ENDPOINTS.sources).toBe('/api/sources')
    expect(api.ENDPOINTS.article(5)).toBe('/api/articles/5')
  })

  it('uses the prefix from VITE_API_PREFIX', async () => {
    const api = await loadLiveApi('/api/v1')
    expect(api.ENDPOINTS.articles).toBe('/api/v1/articles')
  })

  it('sends limit, offset and source_id when loading articles', async () => {
    const fakeFetch = stubFetchJson(200, [
      { id: 1, title: 'A', source_id: 3, source_name: 'Metro Times', content_availability: 'full_text' },
    ])
    const api = await loadLiveApi()

    const result = await api.fetchArticles({ limit: 6, offset: 5, sourceId: '3' })

    expect(fakeFetch.mock.calls[0][0]).toBe(
      'http://backend.test/api/articles?limit=6&offset=5&source_id=3'
    )
    expect(result.total).toBeNull()
    expect(result.articles[0].source_name).toBe('Metro Times')
    expect(result.articles[0].content_availability).toBe('full_text')
  })

  it('reads the total when the backend sends { items, total }', async () => {
    stubFetchJson(200, { items: [{ id: 1, title: 'A' }], total: 40 })
    const api = await loadLiveApi()

    const result = await api.fetchArticles({ limit: 6, offset: 0 })
    expect(result.total).toBe(40)
  })

  it('loads one article and one source by id', async () => {
    const fakeFetch = stubFetchJson(200, { id: 9, title: 'Nine', name: 'Nine' })
    const api = await loadLiveApi()

    await api.fetchArticle(9)
    await api.fetchSource(9)

    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/9')
    expect(fakeFetch.mock.calls[1][0]).toBe('http://backend.test/api/sources/9')
  })

  it('creates a source with POST /api/sources', async () => {
    const fakeFetch = stubFetchJson(201, { id: 9, name: 'Valley News', base_url: 'https://valleynews.example' })
    const api = await loadLiveApi()

    const saved = await api.createSource({ name: 'Valley News', base_url: 'https://valleynews.example' })

    expect(saved.id).toBe(9)
    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('http://backend.test/api/sources')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ name: 'Valley News', base_url: 'https://valleynews.example' })
  })

  it('creates an article with POST /api/articles', async () => {
    const fakeFetch = stubFetchJson(201, { id: 50, title: 'Manual article', content: 'Text' })
    const api = await loadLiveApi()

    const saved = await api.createArticle({ title: 'Manual article', source_id: 1, url: 'https://a.example', content: 'Text' })

    expect(saved.id).toBe(50)
    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles')
  })

  it('rejects a malformed sources reply instead of showing wrong data', async () => {
    stubFetchJson(200, { sources: 'not a list' })
    const api = await loadLiveApi()

    await expect(api.fetchSources()).rejects.toThrow('unexpected format')
  })

  it('explains when a route does not exist in the backend yet', async () => {
    stubFetchJson(404, { detail: 'Not Found' })
    const api = await loadLiveApi()

    await expect(api.fetchSources()).rejects.toThrow(
      'The backend has no route /api/sources (HTTP 404)'
    )
  })

  it('runs news collection with POST /api/ingestion/run and reads the real reply', async () => {
    const fakeFetch = stubFetchJson(200, {
      feeds_attempted: 5,
      feeds_successful: 4,
      articles_inserted: 37,
      articles_skipped_duplicate: 3,
      feed_errors: 1,
      details: [{ source_name: 'Reuters', feed_url: 'https://r.example/feed', status: 'error',
        articles_inserted: 0, articles_skipped_duplicate: 0, error: 'HTTP 404' }],
    })
    const api = await loadLiveApi()
    expect(api.INGESTION_AVAILABLE).toBe(true)

    const result = await api.runNewsCollection()

    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('http://backend.test/api/ingestion/run')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({})
    expect(result.counts.map((count) => count.value)).toEqual([5, 4, 37, 3, 1])
    expect(result.feeds[0].error).toBe('HTTP 404')
  })

  it('refuses to run news collection in mock mode', async () => {
    const api = await import('../api/newsApi')
    expect(api.INGESTION_AVAILABLE).toBe(false)
    await expect(api.runNewsCollection()).rejects.toThrow('only works with the real backend')
  })

  it('passes other backend errors on unchanged', async () => {
    stubFetchJson(404, { detail: 'Article not found' })
    const api = await loadLiveApi()

    await expect(api.fetchArticle(999)).rejects.toThrow('Article not found (HTTP 404)')
  })
})
