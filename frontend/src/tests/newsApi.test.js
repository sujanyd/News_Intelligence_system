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

  it('loads one article\'s matches from GET /api/articles/{id}/matches', async () => {
    const fakeFetch = stubFetchJson(200, [
      { id: 4, article_id_1: 1, article_id_2: 61, match_label: 'DIFFERENT',
        article_1_title: 'A', article_2_title: 'B', article_1_source: 'Reuters', article_2_source: 'TechCrunch' },
    ])
    const api = await loadLiveApi()

    const matches = await api.fetchMatches({ articleId: 1, label: 'DIFFERENT' })

    expect(fakeFetch.mock.calls[0][0]).toBe('http://backend.test/api/articles/1/matches?label=DIFFERENT&limit=100')
    expect(matches[0].article_b.source_name).toBe('TechCrunch')
  })

  it('needs an article for matches, because there is no route listing all of them', async () => {
    const api = await loadLiveApi()
    await expect(api.fetchMatches({})).rejects.toThrow('Choose an article first')
  })

  it('runs matching with POST /api/articles/{id}/match', async () => {
    const fakeFetch = stubFetchJson(200, {
      query_article_id: 5, query_title: 'T', candidates_retrieved: 0,
      matches_created: 0, matches_updated: 0, matches_skipped: 0, matches: [],
    })
    const api = await loadLiveApi()

    const summary = await api.runArticleMatching(5, { candidateLimit: 5, scoreThreshold: -1 })

    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('http://backend.test/api/articles/5/match')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ candidate_limit: 5, score_threshold: -1 })
    expect(summary.candidates_retrieved).toBe(0)
  })

  it('leaves the cutoff to the backend when none is given', async () => {
    const fakeFetch = stubFetchJson(200, { candidates_retrieved: 0, matches: [] })
    const api = await loadLiveApi()

    await api.runArticleMatching(5)

    expect(JSON.parse(fakeFetch.mock.calls[0][1].body)).toEqual({ candidate_limit: 10 })
  })

  it('passes other backend errors on unchanged', async () => {
    stubFetchJson(404, { detail: 'Article not found' })
    const api = await loadLiveApi()

    await expect(api.fetchArticle(999)).rejects.toThrow('Article not found (HTTP 404)')
  })

  it('fetches article embeddings in live mode', async () => {
    const fakeEmbeddings = [
      {
        article_id: 101,
        embedding_type: 'headline',
        status: 'generated',
        model_name: 'all-MiniLM-L6-v2',
        vector_reference: 'art_101_vec',
        dimensions: 384,
        error: null,
      },
    ]
    const fakeFetch = stubFetchJson(200, fakeEmbeddings)
    const api = await loadLiveApi()

    const result = await api.fetchArticleEmbeddings(101)
    expect(fakeFetch).toHaveBeenCalledWith(
      'http://backend.test/api/embeddings/article/101',
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual(fakeEmbeddings)
  })

  it('fetches article embeddings in mock mode', async () => {
    const api = await import('../api/newsApi')
    const embeddings = await api.fetchArticleEmbeddings(101)
    expect(Array.isArray(embeddings)).toBe(true)
    expect(embeddings.length).toBeGreaterThan(0)
    expect(embeddings[0].model_name).toBe('all-MiniLM-L6-v2')
  })

  it('fetches similar articles in live mode', async () => {
    const fakeResponse = {
      query_article_id: 101,
      query_title: 'City council approves new budget',
      embedding_type: 'headline',
      model_name: 'all-MiniLM-L6-v2',
      total_matches: 1,
      matches: [
        {
          article_id: 103,
          title: 'Commuters react',
          similarity_score: 0.884,
        },
      ],
    }
    const fakeFetch = stubFetchJson(200, fakeResponse)
    const api = await loadLiveApi()

    const result = await api.fetchSimilarArticles(101, { limit: 5 })
    expect(fakeFetch).toHaveBeenCalledWith(
      'http://backend.test/api/similarity/article/101?embedding_type=headline&limit=5',
      expect.objectContaining({ method: 'GET' })
    )
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].similarity_score).toBe(0.884)
  })

  it('fetches similar articles in mock mode', async () => {
    const api = await import('../api/newsApi')
    const data = await api.fetchSimilarArticles(101)
    expect(data.matches.length).toBeGreaterThan(0)
    expect(data.matches[0].title).toContain('Commuters react')
    expect(data.matches[0].similarity_score).toBe(0.884)
  })
})

