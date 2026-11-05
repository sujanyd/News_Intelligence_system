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
import {
  toArticle,
  toArticleMatch,
  toArticleMatchList,
  toEmbeddingResultList,
  toEvent,
  toGroupingSummary,
  toIngestionResult,
  toList,
  toMatchRunSummary,
  toSimilarArticlesResponse,
  toSource,
  toStory,
} from './normalize'
import * as mockApi from '../mocks/mockApi'

// Mock mode only when .env says exactly VITE_USE_MOCK_DATA=true
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

// Routes confirmed by Person A (see API_CONTRACT.md).
export const ENDPOINTS = {
  sources: `${API_PREFIX}/sources`,
  source: (id) => `${API_PREFIX}/sources/${encodeURIComponent(id)}`,
  articles: `${API_PREFIX}/articles`,
  article: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}`,
  articleEmbeddings: (id) => `${API_PREFIX}/embeddings/article/${encodeURIComponent(id)}`,
  similarArticles: (id) => `${API_PREFIX}/similarity/article/${encodeURIComponent(id)}`,
  // Matching (app/api/v1/endpoints/matching.py). There is no route that lists
  // every match: the backend lists the matches of ONE article.
  articleMatches: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/matches`,
  runArticleMatch: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/match`,
  match: (id) => `${API_PREFIX}/matches/${encodeURIComponent(id)}`,
  // Stories and events (app/api/v1/endpoints/stories.py and events.py)
  stories: `${API_PREFIX}/stories`,
  story: (id) => `${API_PREFIX}/stories/${encodeURIComponent(id)}`,
  event: (id) => `${API_PREFIX}/events/${encodeURIComponent(id)}`,
  groupArticles: `${API_PREFIX}/stories/group/batch`,
}

// Stories and events only exist in the real backend. There is no mock
// version on purpose: the pages must never show made-up stories or events.
export const STORIES_AVAILABLE = !USE_MOCK_DATA

// Grouping looks at every ungrouped article before it answers, so allow
// more time than a normal request. 200 is the most the backend groups in one call.
export const GROUPING_TIMEOUT_MS = 120000
export const GROUPING_BATCH_LIMIT = 200

// Matching compares an article with its nearest articles before it answers,
// so allow more time than a normal request
export const MATCHING_TIMEOUT_MS = 60000

// News collection (RSS ingestion): POST /ingestion/run (built by Person A).
// It reads every configured RSS feed before it answers, so it can take much
// longer than a normal request: wait up to 2 minutes.
export const INGESTION_ENDPOINT = `${API_PREFIX}/ingestion/run`
export const INGESTION_TIMEOUT_MS = 120000

// A collection run always saves REAL articles in the backend, so it is turned
// off in mock mode: the pages would keep showing sample data and hide the result.
export const INGESTION_AVAILABLE = !USE_MOCK_DATA

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
 * Gets embeddings generated for an article.
 * Endpoint: GET /embeddings/article/{article_id}
 *
 * @param {number | string} articleId
 * @returns {Promise<Array>} List of embedding results
 */
export async function fetchArticleEmbeddings(articleId) {
  const data = USE_MOCK_DATA
    ? await mockApi.getArticleEmbeddings(articleId)
    : await apiGet(ENDPOINTS.articleEmbeddings(articleId))
  return toEmbeddingResultList(data)
}

/**
 * Finds semantically similar articles using vector search.
 * Endpoint: GET /similarity/article/{article_id}
 *
 * @param {number | string} articleId - Query article ID
 * @param {Object} [options]
 * @param {'headline' | 'body'} [options.embedding_type='headline'] - Vector target
 * @param {number} [options.limit=5] - Maximum similar articles to retrieve
 * @param {number} [options.score_threshold] - Minimum cosine similarity score
 * @returns {Promise<{ query_article_id: number, query_title: string, embedding_type: string, model_name: string, total_matches: number, matches: Array }>}
 */
export async function fetchSimilarArticles(
  articleId,
  { embedding_type = 'headline', limit = 5, score_threshold } = {}
) {
  const query = { embedding_type, limit, score_threshold }
  const data = USE_MOCK_DATA
    ? await mockApi.getSimilarArticles(articleId, query)
    : await apiGet(ENDPOINTS.similarArticles(articleId), query)
  return toSimilarArticlesResponse(data)
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
 * Starts one news collection run: POST /ingestion/run with an empty body,
 * so the backend uses its own list of RSS feeds.
 * Only in live mode. There is no mock version on purpose:
 * a pretend run would show counts that never happened.
 *
 * @returns {Promise<{ counts: Array, feeds: Array }>}
 */
export async function runNewsCollection() {
  if (!INGESTION_AVAILABLE) {
    throw new ApiError('News collection only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiPost(INGESTION_ENDPOINT, {}, { timeoutMs: INGESTION_TIMEOUT_MS })
  return toIngestionResult(data)
}

/**
 * Manual classification review persistence is NOT yet implemented in the backend API contract.
 * The frontend operates in read-only review mode by default until endpoints are deployed.
 */
export const MATCH_REVIEW_AVAILABLE = false

/**
 * Gets the stored SAME / RELATED / DIFFERENT matches of one article.
 * Endpoint: GET /articles/{article_id}/matches?label=&limit=
 *
 * @param {Object} options
 * @param {number | string} options.articleId - The article (required: the
 *   backend has no route that lists all matches)
 * @param {'SAME' | 'RELATED' | 'DIFFERENT'} [options.label] - Only this label
 * @returns {Promise<Array<Object>>} List of normalized ArticleMatch objects
 */
export async function fetchMatches({ articleId, label } = {}) {
  if (articleId === undefined || articleId === null || articleId === '') {
    throw new ApiError('Choose an article first: the backend lists matches for one article at a time.')
  }
  const data = USE_MOCK_DATA
    ? await mockApi.getMatches({ articleId, label })
    : await apiGet(ENDPOINTS.articleMatches(articleId), { label, limit: 100 })
  return toArticleMatchList(data)
}

/**
 * Finds the nearest articles to one article and classifies each pair as
 * SAME, RELATED or DIFFERENT. The backend saves the results.
 * Endpoint: POST /articles/{article_id}/match
 *
 * @param {number | string} articleId
 * @param {Object} [options]
 * @param {number} [options.candidateLimit=10] - How many nearest articles to classify
 * @param {number} [options.scoreThreshold] - Lowest vector similarity to consider.
 *   Leave it out to use the backend's own default (0.2).
 * @returns {Promise<Object>} counts and the classified matches
 */
export async function runArticleMatching(articleId, { candidateLimit = 10, scoreThreshold } = {}) {
  const body = { candidate_limit: candidateLimit }
  if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold
  const data = USE_MOCK_DATA
    ? await mockApi.postArticleMatch(articleId, body)
    : await apiPost(ENDPOINTS.runArticleMatch(articleId), body, { timeoutMs: MATCHING_TIMEOUT_MS })
  return toMatchRunSummary(data)
}

/**
 * Gets one article match pair by its ID.
 * Endpoint: GET /matches/{id}
 *
 * @param {number | string} matchId
 * @returns {Promise<Object>} Normalized ArticleMatch object
 */
export async function fetchMatch(matchId) {
  const data = USE_MOCK_DATA
    ? await mockApi.getMatch(matchId)
    : await apiGet(ENDPOINTS.match(matchId))
  return toArticleMatch(data)
}

/**
 * Submits a manual review or classification correction for an article match.
 * The backend has NO review route yet, so in live mode this always fails
 * with a clear message (only the mock backend can save a review).
 *
 * @param {number | string} matchId
 * @param {Object} reviewData
 * @param {boolean} [reviewData.reviewed=true]
 * @param {'SAME' | 'RELATED' | 'DIFFERENT'} [reviewData.match_label]
 * @param {string} [reviewData.reviewer_notes]
 * @returns {Promise<Object>} Updated ArticleMatch object
 */
export async function submitMatchReview(matchId, reviewData = {}) {
  if (!MATCH_REVIEW_AVAILABLE && !USE_MOCK_DATA) {
    throw new ApiError(
      'Manual review persistence is not currently supported by the backend. The interface is operating in read-only mode.'
    )
  }
  const data = await mockApi.updateMatchReview(matchId, reviewData)
  return toArticleMatch(data)
}


// Used by the story and event functions below when mock mode is on
function requireStoriesBackend() {
  if (!STORIES_AVAILABLE) {
    throw new ApiError('Stories and events only work with the real backend (VITE_USE_MOCK_DATA=false).')
  }
}

/**
 * Gets one page of stories, newest first.
 * Endpoint: GET /stories?skip=&limit=
 * Note: this route pages with "skip". It ignores "offset".
 *
 * @param {Object} [options]
 * @param {number} [options.limit] - How many stories to get (1 to 100)
 * @param {number} [options.skip] - How many stories to skip first
 * @returns {Promise<Array>} list of stories (without events or articles)
 */
export async function fetchStories({ limit, skip } = {}) {
  requireStoriesBackend()
  const data = await apiGet(ENDPOINTS.stories, { limit, skip })
  return toList(data, 'story').items.map(toStory)
}

/**
 * Gets one story with its events and its articles.
 * Endpoint: GET /stories/{story_id}
 */
export async function fetchStory(storyId) {
  requireStoriesBackend()
  return toStory(await apiGet(ENDPOINTS.story(storyId)))
}

/**
 * Gets one event with its story title and its articles.
 * Endpoint: GET /events/{event_id}
 */
export async function fetchEvent(eventId) {
  requireStoriesBackend()
  return toEvent(await apiGet(ENDPOINTS.event(eventId)))
}

/**
 * Puts every article that is not in a story yet into a story and an event.
 * News collection does not do this by itself.
 * Endpoint: POST /stories/group/batch?limit=200
 *
 * @returns {Promise<Object>} how many articles were grouped and how many
 *   stories and events were created or reused
 */
export async function groupArticlesIntoStories() {
  requireStoriesBackend()
  const data = await apiPost(ENDPOINTS.groupArticles, {}, {
    timeoutMs: GROUPING_TIMEOUT_MS,
    query: { limit: GROUPING_BATCH_LIMIT },
  })
  return toGroupingSummary(data)
}
