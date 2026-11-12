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

import { ApiError, apiGet, apiPost, apiRequest } from './client'
import { API_PREFIX } from './config'
import {
  toArticle,
  toArticleMatch,
  toArticleInsights,
  toArticleMatchList,
  toEmbeddingResultList,
  toEvent,
  toGroupingSummary,
  toIngestionResult,
  toList,
  toMatchRunSummary,
  toPoliticalAnalysis,
  toToneFraming,
  toFeed,
  toAiDetection,
  toComparison,
  toComparisonSummary,
  toDashboardSummary,
  toDuplicateCheck,
  toReport,
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
  events: `${API_PREFIX}/events`,
  event: (id) => `${API_PREFIX}/events/${encodeURIComponent(id)}`,
  groupArticles: `${API_PREFIX}/stories/group/batch`,
  // Content extraction (app/api/v1/endpoints/content_extraction.py)
  articleExtraction: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/extraction`,
  runArticleExtraction: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/extract`,
  // Political signals (app/api/v1/endpoints/political_signal.py)
  articlePolitical: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/political-signals`,
  // Tone and framing (app/api/v1/endpoints/tone_framing.py)
  articleToneFraming: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/tone-framing`,
  // RSS feeds the news collection reads (app/api/v1/endpoints/ingestion.py)
  ingestionFeeds: `${API_PREFIX}/ingestion/feeds`,
  // Comparisons and reports (app/api/v1/endpoints/comparison_report.py)
  comparisons: `${API_PREFIX}/comparisons`,
  comparison: (id) => `${API_PREFIX}/comparisons/${encodeURIComponent(id)}`,
  reports: `${API_PREFIX}/reports`,
  report: (id) => `${API_PREFIX}/reports/${encodeURIComponent(id)}`,
  generateReport: `${API_PREFIX}/reports/generate`,
  // AI detection (app/api/v1/endpoints/ai_detection.py)
  articleAiDetection: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/ai-detection`,
  runArticleAiDetection: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/ai-detection/analyze`,
  flaggedAiDetections: `${API_PREFIX}/articles/ai-detection/flagged`,
  // Every dashboard total in one request (app/api/v1/endpoints/dashboard.py)
  dashboardSummary: `${API_PREFIX}/dashboard/summary`,
  // Exact / near-duplicate check of one article (app/api/v1/endpoints/comparison_report.py)
  detectDuplicates: (id) => `${API_PREFIX}/articles/${encodeURIComponent(id)}/detect-duplicates`,
}

// The duplicate check only exists in the real backend
export const DUPLICATE_CHECK_AVAILABLE = !USE_MOCK_DATA

// The dashboard summary route only exists in the real backend
export const DASHBOARD_SUMMARY_AVAILABLE = !USE_MOCK_DATA

// Comparisons, reports and AI detection only exist in the real backend.
// There is no mock version on purpose: nothing made up is ever shown.
export const COMPARISONS_AVAILABLE = !USE_MOCK_DATA
export const AI_DETECTION_AVAILABLE = !USE_MOCK_DATA

// Creating a comparison analyses every article in it, so allow more time
export const COMPARISON_TIMEOUT_MS = 120000

// Tone and framing only exist in the real backend. There is no mock version
// on purpose: no made-up tone labels or framing signals are ever shown.
export const TONE_AVAILABLE = !USE_MOCK_DATA

// Political analysis only exists in the real backend. There is no mock
// version on purpose: no made-up politicians or signals are ever shown.
export const POLITICAL_AVAILABLE = !USE_MOCK_DATA

// Extracted topics, entities, facts and quotes only exist in the real
// backend. There is no mock version on purpose: nothing made up is shown.
export const INSIGHTS_AVAILABLE = !USE_MOCK_DATA

// The first time an article is asked for, the backend extracts its insights
// before it answers, so allow a little more time than a normal request
export const EXTRACTION_TIMEOUT_MS = 30000

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

// One extraction request per article at a time. The article page opens the
// insights, political and tone sections together, and all three need the
// extraction; they now share one request instead of sending three.
const extractionRequests = new Map()

function loadExtraction(articleId) {
  const key = String(articleId)
  if (!extractionRequests.has(key)) {
    const request = apiRequest(ENDPOINTS.articleExtraction(articleId), {
      timeoutMs: EXTRACTION_TIMEOUT_MS,
    }).finally(() => extractionRequests.delete(key))
    extractionRequests.set(key, request)
  }
  return extractionRequests.get(key)
}

// Workaround for a backend problem (see API_CONTRACT.md, 9 Nov 2026): if the
// political or the tone analysis runs BEFORE the content extraction, the
// article's topics, facts and quotes stay empty for good. So make sure the
// extraction has run first. If it fails, carry on anyway.
function extractionFirst(articleId) {
  return loadExtraction(articleId).catch(() => null)
}

/**
 * Gets the topics, entities, facts and quotes the backend extracted from
 * one article. If the article was never analysed, the backend analyses it
 * first and saves the result, then answers.
 * Endpoint: GET /articles/{article_id}/extraction
 *
 * @param {number | string} articleId
 * @returns {Promise<Object>} the checked insights (see toArticleInsights)
 */
export async function fetchArticleInsights(articleId) {
  if (!INSIGHTS_AVAILABLE) {
    throw new ApiError('Article insights only work with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await loadExtraction(articleId)
  return toArticleInsights(data)
}

/**
 * Analyses the article again and replaces its insights with the new result.
 * Endpoint: POST /articles/{article_id}/extract with { force_reanalyze: true }
 */
export async function rerunArticleInsights(articleId) {
  if (!INSIGHTS_AVAILABLE) {
    throw new ApiError('Article insights only work with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiPost(
    ENDPOINTS.runArticleExtraction(articleId),
    { force_reanalyze: true },
    { timeoutMs: EXTRACTION_TIMEOUT_MS }
  )
  return toArticleInsights(data)
}

/**
 * Gets the political entities and presentation signals of one article.
 * If the article was never analysed, the backend analyses it first and
 * saves the result, then answers.
 * Endpoint: GET /articles/{article_id}/political-signals
 *
 * @param {number | string} articleId
 * @returns {Promise<Object>} the checked analysis (see toPoliticalAnalysis)
 */
export async function fetchPoliticalAnalysis(articleId) {
  if (!POLITICAL_AVAILABLE) {
    throw new ApiError('Political analysis only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  await extractionFirst(articleId)

  const data = await apiRequest(ENDPOINTS.articlePolitical(articleId), {
    timeoutMs: EXTRACTION_TIMEOUT_MS,
  })
  return toPoliticalAnalysis(data)
}

/**
 * Tone and framing of one article: its overall tone, how the headline is
 * framed, and the framing signals found in the text (with evidence).
 * The first time, the backend analyses the article before it answers.
 *
 * @param {number | string} articleId
 * @returns {Promise<Object>} the checked analysis (see toToneFraming)
 */
export async function fetchToneFraming(articleId) {
  if (!TONE_AVAILABLE) {
    throw new ApiError('Tone and framing only work with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  await extractionFirst(articleId)

  const data = await apiRequest(ENDPOINTS.articleToneFraming(articleId), {
    timeoutMs: EXTRACTION_TIMEOUT_MS,
  })
  return toToneFraming(data)
}

// ---------------------------------------------------------------------------
// Totals and whole lists
//
// The backend has no "count" route, and its list routes send at most 100
// items per call. So a total is found by reading the list page by page until
// a page comes back short. MAX_PAGES stops this on a very large database:
// then the result says it is not complete ("2000+").
// ---------------------------------------------------------------------------

/**
 * Every dashboard total in one request: articles, sources, stories, events,
 * comparisons, reports and articles flagged for review, plus the embedding
 * provider, its vector size and how Qdrant is stored.
 * Endpoint: GET /dashboard/summary (real backend only)
 *
 * @returns {Promise<Object>} see toDashboardSummary in normalize.js
 */
export async function fetchDashboardSummary() {
  if (!DASHBOARD_SUMMARY_AVAILABLE) {
    throw new ApiError('The dashboard summary only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiGet(ENDPOINTS.dashboardSummary)
  return toDashboardSummary(data)
}

/**
 * Asks the backend whether an article is an exact or near-duplicate of an
 * earlier one. When it is, the backend stores the link
 * (duplicate_of_article_id), so this is only run when the user asks.
 * Endpoint: POST /articles/{id}/detect-duplicates (real backend only)
 *
 * @param {number | string} articleId
 * @returns {Promise<Object>} see toDuplicateCheck in normalize.js
 */
export async function checkArticleDuplicates(articleId) {
  if (!DUPLICATE_CHECK_AVAILABLE) {
    throw new ApiError('The duplicate check only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiPost(ENDPOINTS.detectDuplicates(articleId), {}, { timeoutMs: EXTRACTION_TIMEOUT_MS })
  return toDuplicateCheck(data)
}

const PAGE_SIZE = 100
const MAX_PAGES = 20

/**
 * Reads a list page by page.
 *
 * @param {(page: { limit: number, start: number }) => Promise<Array>} loadPage
 * @returns {Promise<{ items: Array, isComplete: boolean }>}
 *   isComplete is false when MAX_PAGES was reached and more may exist
 */
export async function readAllPages(loadPage) {
  const items = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageItems = await loadPage({ limit: PAGE_SIZE, start: page * PAGE_SIZE })
    items.push(...pageItems)
    if (pageItems.length < PAGE_SIZE) return { items, isComplete: true }
  }
  return { items, isComplete: false }
}

/**
 * How many articles the backend has.
 * Reads GET /articles?limit=100&offset=... until a short page.
 *
 * @returns {Promise<{ count: number, isComplete: boolean }>}
 */
export async function countArticles() {
  const { items, isComplete } = await readAllPages(async ({ limit, start }) => {
    const result = await fetchArticles({ limit, offset: start })
    return result.articles
  })
  return { count: items.length, isComplete }
}

/**
 * For one news source: how many articles it has and its newest article.
 * The backend has no per-source summary route, so this reads
 * GET /articles?source_id=...&limit=100&offset=... until a short page.
 * The backend sends the newest article (by publication time) first.
 *
 * @param {number | string} sourceId
 * @returns {Promise<{ count: number, isComplete: boolean, newest: Object | null }>}
 */
export async function fetchSourceActivity(sourceId) {
  const { items, isComplete } = await readAllPages(async ({ limit, start }) => {
    const result = await fetchArticles({ limit, offset: start, sourceId })
    return result.articles
  })
  return { count: items.length, isComplete, newest: items[0] || null }
}

/**
 * The stored SAME / RELATED / DIFFERENT matches of the newest articles.
 * The backend can only list the matches of ONE article, so this asks for
 * the newest few articles and then their matches (one request each). A pair
 * found from both of its articles is counted once.
 * Endpoints: GET /articles?limit=N, then GET /articles/{id}/matches
 *
 * @param {{ articleLimit?: number }} [options]
 * @returns {Promise<{ articlesChecked: number, articlesWithMatches: number,
 *   matches: Array, counts: { SAME: number, RELATED: number, DIFFERENT: number },
 *   failedArticles: number }>}
 */
export async function fetchRecentMatchActivity({ articleLimit = 10 } = {}) {
  const { articles } = await fetchArticles({ limit: articleLimit, offset: 0 })
  const results = await Promise.allSettled(
    articles.map((article) => fetchMatches({ articleId: article.id }))
  )
  const matchesById = new Map()
  let articlesWithMatches = 0
  let failedArticles = 0
  for (const result of results) {
    if (result.status === 'rejected') {
      failedArticles += 1
      continue
    }
    if (result.value.length > 0) articlesWithMatches += 1
    for (const match of result.value) matchesById.set(String(match.id), match)
  }
  const matches = [...matchesById.values()]
  const counts = { SAME: 0, RELATED: 0, DIFFERENT: 0 }
  for (const match of matches) counts[match.match_label] += 1
  // Newest stored match first
  matches.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return { articlesChecked: articles.length, articlesWithMatches, matches, counts, failedArticles }
}

/**
 * How many articles the backend flagged for editorial review (estimate of
 * AI_FLAG_THRESHOLD or more). Reads GET /articles/ai-detection/flagged
 * page by page; an article checked twice is counted once.
 *
 * @returns {Promise<{ count: number, isComplete: boolean }>}
 */
export async function countFlaggedAiDetections() {
  if (!AI_DETECTION_AVAILABLE) {
    throw new ApiError('AI detection only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const { items, isComplete } = await readAllPages(async ({ limit, start }) => {
    const data = await apiGet(ENDPOINTS.flaggedAiDetections, { limit, offset: start })
    return toList(data, 'flagged article').items.map(toAiDetection)
  })
  return { count: new Set(items.map((item) => item.article_id)).size, isComplete }
}

/**
 * Every story (without its events and articles).
 * Reads GET /stories?limit=100&skip=... until a short page.
 *
 * @returns {Promise<{ items: Array, isComplete: boolean }>}
 */
export async function fetchAllStories() {
  return readAllPages(({ limit, start }) => fetchStories({ limit, skip: start }))
}

/**
 * How many events the backend has.
 * Reads GET /events?limit=100&skip=... until a short page.
 *
 * @returns {Promise<{ count: number, isComplete: boolean }>}
 */
export async function countEvents() {
  requireStoriesBackend()
  const { items, isComplete } = await readAllPages(async ({ limit, start }) => {
    const data = await apiGet(ENDPOINTS.events, { limit, skip: start })
    return toList(data, 'event').items
  })
  return { count: items.length, isComplete }
}

/**
 * The RSS feeds the news collection reads by default.
 * Endpoint: GET /ingestion/feeds (real backend only)
 *
 * @returns {Promise<Array<{ source_name, base_url, feed_url }>>}
 */
export async function fetchIngestionFeeds() {
  if (!INGESTION_AVAILABLE) {
    throw new ApiError('The RSS feed list only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiGet(ENDPOINTS.ingestionFeeds)
  return toList(data, 'feed').items.map(toFeed)
}

// ---------------------------------------------------------------------------
// All analyses of one article (used by Comparisons and Reports)
// ---------------------------------------------------------------------------

/**
 * Loads the insights, tone and framing, and political analysis of one
 * article. One failing analysis does not stop the others: it comes back as
 * null, with its error message.
 *
 * @param {number | string} articleId
 * @returns {Promise<{ insights: Object | null, tone: Object | null,
 *   political: Object | null, errors: { insights?: string, tone?: string, political?: string } }>}
 */
export async function fetchArticleAnalyses(articleId) {
  // Started together, so all three share ONE extraction request
  // (loadExtraction); tone and political still wait for it (extractionFirst).
  const [insights, tone, political] = await Promise.allSettled([
    fetchArticleInsights(articleId),
    fetchToneFraming(articleId),
    fetchPoliticalAnalysis(articleId),
  ])

  const errors = {}
  const valueOf = (result, name) => {
    if (result.status === 'fulfilled') return result.value
    errors[name] = result.reason?.message || 'Unknown error'
    return null
  }
  return {
    insights: valueOf(insights, 'insights'),
    tone: valueOf(tone, 'tone'),
    political: valueOf(political, 'political'),
    errors,
  }
}

// ---------------------------------------------------------------------------
// Comparisons (saved in the backend)
// ---------------------------------------------------------------------------

function requireComparisonsBackend() {
  if (!COMPARISONS_AVAILABLE) {
    throw new ApiError('Comparisons and reports only work with the real backend (VITE_USE_MOCK_DATA=false).')
  }
}

/**
 * Every saved comparison, newest first (GET /comparisons, all pages).
 * @returns {Promise<{ items: Array, isComplete: boolean }>}
 */
export async function fetchAllComparisons() {
  requireComparisonsBackend()
  return readAllPages(async ({ limit, start }) => {
    const data = await apiGet(ENDPOINTS.comparisons, { limit, offset: start })
    return toList(data, 'comparison').items.map(toComparisonSummary)
  })
}

/**
 * One comparison with its articles, coverage and evidence.
 * Endpoint: GET /comparisons/{id}
 */
export async function fetchComparison(comparisonId) {
  requireComparisonsBackend()
  return toComparison(await apiGet(ENDPOINTS.comparison(comparisonId)))
}

/**
 * A comparison and, when it belongs to an event, that event (for its time).
 * A missing event is not an error: the comparison is still shown.
 * Endpoints: GET /comparisons/{id}, then GET /events/{event_id}
 *
 * @returns {Promise<{ comparison: Object, events: Array }>}
 */
export async function fetchComparisonWithEvent(comparisonId) {
  const comparison = await fetchComparison(comparisonId)
  if (comparison.event_id === null) return { comparison, events: [] }
  try {
    return { comparison, events: [await fetchEvent(comparison.event_id)] }
  } catch {
    return { comparison, events: [] }
  }
}

/**
 * Creates (and runs) a comparison of some articles.
 * Endpoint: POST /comparisons with { title, description, article_ids }
 *
 * The backend runs the political analysis of each article while it compares.
 * Run the content extraction of each article first, or their topics, facts
 * and quotes would stay empty (see extractionFirst).
 *
 * @param {{ title: string, description?: string, articleIds: number[] }} input
 * @returns {Promise<Object>} the new comparison (see toComparison)
 */
export async function createComparison({ title, description, articleIds }) {
  requireComparisonsBackend()
  for (const articleId of articleIds) {
    await extractionFirst(articleId)
  }
  const data = await apiPost(
    ENDPOINTS.comparisons,
    { title, description: description || null, article_ids: articleIds },
    { timeoutMs: COMPARISON_TIMEOUT_MS }
  )
  return toComparison(data)
}

// ---------------------------------------------------------------------------
// Reports (saved in the backend)
// ---------------------------------------------------------------------------

/**
 * Every saved report, newest first (GET /reports, all pages).
 * @returns {Promise<{ items: Array, isComplete: boolean }>}
 */
export async function fetchAllReports() {
  requireComparisonsBackend()
  return readAllPages(async ({ limit, start }) => {
    const data = await apiGet(ENDPOINTS.reports, { limit, offset: start })
    return toList(data, 'report').items.map(toReport)
  })
}

/**
 * One saved report. Endpoint: GET /reports/{id}
 */
export async function fetchReport(reportId) {
  requireComparisonsBackend()
  return toReport(await apiGet(ENDPOINTS.report(reportId)))
}

/**
 * Generates and saves a report from a comparison.
 * Endpoint: POST /reports/generate with { comparison_id, title, report_format }
 *
 * @param {{ comparisonId: number, title?: string, format?: 'markdown' | 'html' | 'json' }} input
 */
export async function generateReport({ comparisonId, title, format = 'markdown' }) {
  requireComparisonsBackend()
  const data = await apiPost(
    ENDPOINTS.generateReport,
    { comparison_id: comparisonId, title: title || null, report_format: format },
    { timeoutMs: COMPARISON_TIMEOUT_MS }
  )
  return toReport(data)
}

// ---------------------------------------------------------------------------
// AI detection
// ---------------------------------------------------------------------------

/**
 * The AI-likelihood estimate of one article. The first time, the backend
 * computes it before it answers.
 * Endpoint: GET /articles/{id}/ai-detection
 */
export async function fetchAiDetection(articleId) {
  if (!AI_DETECTION_AVAILABLE) {
    throw new ApiError('AI detection only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiRequest(ENDPOINTS.articleAiDetection(articleId), {
    timeoutMs: EXTRACTION_TIMEOUT_MS,
  })
  return toAiDetection(data)
}

/**
 * Computes the estimate again.
 * Endpoint: POST /articles/{id}/ai-detection/analyze with { force_reanalyze: true }
 */
export async function rerunAiDetection(articleId) {
  if (!AI_DETECTION_AVAILABLE) {
    throw new ApiError('AI detection only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiPost(
    ENDPOINTS.runArticleAiDetection(articleId),
    { force_reanalyze: true },
    { timeoutMs: EXTRACTION_TIMEOUT_MS }
  )
  return toAiDetection(data)
}

// The backend flags an article for review when its estimate is 0.75 or more
// (flag_threshold in app/services/ai_detection.py)
export const AI_FLAG_THRESHOLD = 0.75

/**
 * Articles the backend flagged for a human to check, highest estimate first.
 * Only articles whose AI detection has already run can be in this list (it
 * runs the first time an article's details are opened).
 * Endpoint: GET /articles/ai-detection/flagged?limit&offset
 *
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array>} AI detection results (see toAiDetection); they
 *   hold the article id but not its title
 */
export async function fetchFlaggedAiDetections({ limit = 10 } = {}) {
  if (!AI_DETECTION_AVAILABLE) {
    throw new ApiError('AI detection only works with the real backend (VITE_USE_MOCK_DATA=false).')
  }
  const data = await apiGet(ENDPOINTS.flaggedAiDetections, { limit, offset: 0 })
  return toList(data, 'flagged article').items.map(toAiDetection)
}
