/**
 * API Client Utility
 *
 * One place that talks to the backend. Every request goes through
 * apiRequest(), which:
 *   1. builds the full URL (with ?query=values),
 *   2. stops waiting after REQUEST_TIMEOUT_MS,
 *   3. turns every problem into an ApiError with a message people can read.
 *
 * It never hides a failure: if something goes wrong, it throws.
 */

import { API_BASE_URL, getApiEndpoint } from './config'

// Give up if the backend has not answered after 10 seconds
export const REQUEST_TIMEOUT_MS = 10000

/**
 * Error thrown for any failed API request.
 * "status" is the HTTP status code (like 404), or null if the server never answered.
 */
export class ApiError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Builds the full URL, adding query values like ?limit=5&offset=0.
 * Empty values (null, undefined, '') are skipped.
 */
export function buildUrl(path, query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value))
    }
  }
  const queryText = params.toString()
  const url = getApiEndpoint(path)
  return queryText ? `${url}?${queryText}` : url
}

/**
 * FastAPI sends errors as {"detail": "text"} or, for invalid input,
 * {"detail": [{"msg": "..."}, ...]}. This picks out readable text.
 *
 * @returns {string | null}
 */
export function readErrorDetail(body) {
  if (!body || body.detail === undefined) {
    return null
  }
  if (typeof body.detail === 'string') {
    return body.detail
  }
  if (Array.isArray(body.detail)) {
    const messages = body.detail.map((item) => item && item.msg).filter(Boolean)
    return messages.length > 0 ? messages.join(' ') : null
  }
  return null
}

/**
 * Sends one request to the backend and returns the JSON answer.
 *
 * @param {string} path - e.g. '/api/sources'
 * @param {Object} [options]
 * @param {'GET' | 'POST'} [options.method='GET']
 * @param {Object} [options.body] - Data to send as JSON (for POST)
 * @param {Object} [options.query] - Values to add after "?" in the URL
 * @returns {Promise<any>} the parsed JSON
 * @throws {ApiError}
 */
export async function apiRequest(path, { method = 'GET', body, query } = {}) {
  if (!API_BASE_URL) {
    throw new ApiError(
      'The backend URL is not set. Add VITE_API_BASE_URL to frontend/.env and restart the dev server.'
    )
  }

  // Step 1: send the request (and stop waiting if it takes too long)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('The backend took too long to respond. Please try again.')
    }
    // fetch() fails like this when the server is off, the address is wrong, or CORS blocks it
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL}. Check that it is running and allows requests from this site (CORS).`
    )
  } finally {
    clearTimeout(timer)
  }

  // Step 2: read the answer as JSON (an empty answer becomes null)
  const text = await response.text()
  let data = null
  let isValidJson = true
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      isValidJson = false
    }
  }

  // Step 3: an error status (like 404 or 500) is always an error
  if (!response.ok) {
    const detail = isValidJson ? readErrorDetail(data) : null

    // FastAPI answers exactly "Not Found" when the route itself does not exist
    if (response.status === 404 && detail === 'Not Found') {
      throw new ApiError(
        `The backend has no route ${path} (HTTP 404). It may not be built yet, or VITE_API_PREFIX may be wrong.`,
        404
      )
    }

    const message = detail
      ? `${detail} (HTTP ${response.status})`
      : `The backend returned an error (HTTP ${response.status}).`
    throw new ApiError(message, response.status)
  }

  if (!isValidJson) {
    throw new ApiError('The backend sent a reply that is not valid JSON.', response.status)
  }

  return data
}

/** Shortcut for a GET request. */
export function apiGet(path, query) {
  return apiRequest(path, { query })
}

/** Shortcut for a POST request with a JSON body. */
export function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body })
}
