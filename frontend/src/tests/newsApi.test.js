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

  // Load a fresh copy of newsApi with mock mode turned off
  async function loadLiveApi() {
    vi.stubEnv('VITE_USE_MOCK_DATA', 'false')
    vi.resetModules()
    return import('../api/newsApi')
  }

  it('calls the backend for articles instead of using mock data', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fakeFetch)

    const api = await loadLiveApi()
    expect(api.USE_MOCK_DATA).toBe(false)

    const articles = await api.fetchArticles()
    expect(articles).toEqual([])
    expect(fakeFetch.mock.calls[0][0]).toMatch(/\/api\/v1\/articles$/)
  })

  it('sends a POST request when adding a source', async () => {
    const savedSource = { id: 9, name: 'Valley News', base_url: 'https://valleynews.example' }
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => savedSource })
    vi.stubGlobal('fetch', fakeFetch)

    const api = await loadLiveApi()
    const result = await api.createSource({ name: 'Valley News', base_url: 'https://valleynews.example' })

    expect(result).toEqual(savedSource)
    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/sources$/)
    expect(options.method).toBe('POST')
  })

  it('throws an error when the backend answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }))

    const api = await loadLiveApi()
    await expect(api.fetchSources()).rejects.toThrow('500')
  })
})
