import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiGet, apiPost, buildUrl, readErrorDetail, ApiError, REQUEST_TIMEOUT_MS } from '../api/client'

// Makes a pretend fetch() answer
function fakeResponse(status, bodyText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.resetModules()
})

describe('buildUrl', () => {
  it('joins the base URL and the path', () => {
    expect(buildUrl('/api/sources')).toBe('http://backend.test/api/sources')
  })

  it('adds query values and skips empty ones', () => {
    const url = buildUrl('/api/articles', { limit: 6, offset: 0, source_id: undefined })
    expect(url).toBe('http://backend.test/api/articles?limit=6&offset=0')
  })
})

describe('readErrorDetail', () => {
  it('reads a FastAPI text error', () => {
    expect(readErrorDetail({ detail: 'Source not found' })).toBe('Source not found')
  })

  it('reads FastAPI validation errors', () => {
    const body = { detail: [{ msg: 'Field required' }, { msg: 'Invalid URL' }] }
    expect(readErrorDetail(body)).toBe('Field required Invalid URL')
  })

  it('returns null when there is no detail', () => {
    expect(readErrorDetail({ message: 'oops' })).toBeNull()
    expect(readErrorDetail(null)).toBeNull()
  })
})

describe('apiGet and apiPost', () => {
  it('returns the JSON from a successful reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, '[{"id":1}]')))
    expect(await apiGet('/api/sources')).toEqual([{ id: 1 }])
  })

  it('sends POST data as JSON', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(fakeResponse(201, '{"id":7}'))
    vi.stubGlobal('fetch', fakeFetch)

    await apiPost('/api/sources', { name: 'Valley News' })

    const options = fakeFetch.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe('{"name":"Valley News"}')
  })

  it('throws the backend error text and status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, '{"detail":"Name already used"}')))

    const error = await apiPost('/api/sources', {}).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.message).toBe('Name already used (HTTP 409)')
  })

  it('never turns an error status into success, even without JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, '<html>Internal error</html>')))
    await expect(apiGet('/api/sources')).rejects.toThrow('The backend returned an error (HTTP 500).')
  })

  it('throws when a successful reply is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, 'not json')))
    await expect(apiGet('/api/sources')).rejects.toThrow('not valid JSON')
  })

  it('explains a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiGet('/api/sources')).rejects.toThrow(
      'Could not reach the backend at http://backend.test'
    )
  })

  it('stops waiting when the backend is too slow', async () => {
    vi.useFakeTimers()
    // A fetch that only ends when it is cancelled
    const slowFetch = vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const abortError = new Error('aborted')
        abortError.name = 'AbortError'
        reject(abortError)
      })
    }))
    vi.stubGlobal('fetch', slowFetch)

    const request = apiGet('/api/sources').catch((caught) => caught)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    const error = await request
    expect(error.message).toBe('The backend took too long to respond. Please try again.')
  })

  it('waits longer when a request asks for a longer timeout', async () => {
    vi.useFakeTimers()
    let wasCancelled = false
    vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(() => {
      options.signal.addEventListener('abort', () => {
        wasCancelled = true
      })
    })))

    apiPost('/api/ingestion/run', {}, { timeoutMs: 60000 }).catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    expect(wasCancelled).toBe(false) // a normal request would have given up here

    await vi.advanceTimersByTimeAsync(60000 - REQUEST_TIMEOUT_MS)
    expect(wasCancelled).toBe(true)
  })

  it('says clearly when the backend URL is not configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    const freshClient = await import('../api/client')
    const fakeFetch = vi.fn()
    vi.stubGlobal('fetch', fakeFetch)

    await expect(freshClient.apiGet('/api/sources')).rejects.toThrow('The backend URL is not set')
    expect(fakeFetch).not.toHaveBeenCalled()
  })
})
