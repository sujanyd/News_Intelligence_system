/**
 * News API Module
 *
 * Every article and source request goes through the functions in this file.
 * The pages never call fetch() themselves.
 *
 * Two modes:
 * - Live mode (default): calls the FastAPI backend at VITE_API_BASE_URL.
 * - Mock mode: VITE_USE_MOCK_DATA=true uses the pretend backend in
 *   src/mocks/mockApi.js. The pages then show a "Mock data" badge.
 *
 * In both modes the reply is checked by normalize.js before the pages use it.
 */

import { ApiError, apiGet, apiPost } from './client'
import { API_PREFIX } from './config'
import { toArticle, toIngestionResult, toList, toSource } from './normalize'
import * as mockApi from '../mocks/mockApi'

// Mock mode only when .env says exactly VITE_USE_MOCK_DATA=true
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

// Routes confirmed by Person A (see API_CONTRACT.md).
export const ENDPOINTS = {
  sources: `${API_PREFIX}/sources`,
  source: (id) => `${API_PREFIX}/sources/${encodeURIComponent(id)}`,
  articles: `${API_PREFIX}/articles`,
  article: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}`,
}

// News collection (RSS ingestion) is NOT built in the backend yet, so there is
// no route for it. When Person A adds one, put its path here (for example
// `${API_PREFIX}/ingestion/run`) and check the method and reply in API_CONTRACT.md.
// While this is null, the dashboard shows the "Run News Collection" button disabled.
export const INGESTION_ENDPOINT = null
export const INGESTION_AVAILABLE = INGESTION_ENDPOINT !== null

/**
 * Gets all news sources.
 * @returns {Promise<Array>} list of sources
 */
export async function fetchSources() {
  const data = USE_MOCK_DATA ? await mockApi.getSources() : await apiGet(ENDPOINTS.sources)
  return toList(data, 'source').items.map(toSource)
}

/**
 * Gets one news source by its id.
 */
export async function fetchSource(sourceId) {
  const data = USE_MOCK_DATA
    ? await mockApi.getSource(sourceId)
    : await apiGet(ENDPOINTS.source(sourceId))
  return toSource(data)
}

/**
 * Saves a new news source.
 * @param {{ name: string, base_url: string }} newSource
 * @returns {Promise<Object>} the saved source (with its new id)
 */
export async function createSource(newSource) {
  const data = USE_MOCK_DATA
    ? await mockApi.postSource(newSource)
    : await apiPost(ENDPOINTS.sources, newSource)
  return toSource(data)
}

/**
 * Gets one page of articles.
 *
 * @param {Object} [options]
 * @param {number} [options.limit] - How many articles to get
 * @param {number} [options.offset] - How many articles to skip first
 * @param {number | string} [options.sourceId] - Only articles from this source
 * @returns {Promise<{ articles: Array, total: number | null }>}
 *   total is null when the backend does not say how many there are in all
 */
export async function fetchArticles({ limit, offset, sourceId } = {}) {
  const query = { limit, offset, source_id: sourceId }
  const data = USE_MOCK_DATA
    ? await mockApi.getArticles(query)
    : await apiGet(ENDPOINTS.articles, query)
  const list = toList(data, 'article')
  return { articles: list.items.map(toArticle), total: list.total }
}

/**
 * Gets one article by its id (with its full content).
 */
export async function fetchArticle(articleId) {
  const data = USE_MOCK_DATA
    ? await mockApi.getArticle(articleId)
    : await apiGet(ENDPOINTS.article(articleId))
  return toArticle(data)
}

/**
 * Saves a new article (manual entry). Required fields still to be confirmed
 * with Person A; the database needs source_id, title, content and url.
 */
export async function createArticle(newArticle) {
  const data = USE_MOCK_DATA
    ? await mockApi.postArticle(newArticle)
    : await apiPost(ENDPOINTS.articles, newArticle)
  return toArticle(data)
}

/**
 * Asks the backend if it is running (GET /health). This route already exists.
 * Always uses the real backend, even in mock mode.
 */
export async function checkBackendHealth() {
  return apiGet('/health')
}

/**
 * Starts one news collection run (fetches the RSS feeds).
 * Only works once INGESTION_ENDPOINT is set. There is no mock version on purpose:
 * a pretend run would show counts that never happened.
 *
 * @returns {Promise<{ counts: Array, errors: string[] | null }>}
 */
export async function runNewsCollection() {
  if (!INGESTION_AVAILABLE) {
    throw new ApiError('News collection is not available yet: the backend has no collection endpoint.')
  }
  const data = await apiPost(INGESTION_ENDPOINT, {})
  return toIngestionResult(data)
}
