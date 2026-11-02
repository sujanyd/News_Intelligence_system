/**
 * MOCK API (pretend backend, NOT real)
 *
 * Copies how the planned backend endpoints should behave, using the sample
 * data in mockData.js. Used only when VITE_USE_MOCK_DATA=true, and by tests.
 *
 * Each function returns raw JSON like the backend would. newsApi.js then
 * checks it with the same code it uses for real replies.
 */

import { ApiError } from '../api/client'
import { MOCK_ARTICLES, MOCK_EMBEDDINGS, MOCK_SIMILARITY_DATA, MOCK_SOURCES } from './mockData'

// Small pause so the loading state can be seen (no pause in tests)
const MOCK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 500

// Copies of the sample data, so adding a source does not change the original list
let sources = [...MOCK_SOURCES]
let articles = [...MOCK_ARTICLES]
let embeddings = [...MOCK_EMBEDDINGS]
let similarityData = { ...MOCK_SIMILARITY_DATA }

function wait() {
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
}

/** Puts the sample data back to how it started. Used by the tests. */
export function resetMockData() {
  sources = [...MOCK_SOURCES]
  articles = [...MOCK_ARTICLES]
  embeddings = [...MOCK_EMBEDDINGS]
  similarityData = { ...MOCK_SIMILARITY_DATA }
}

/** Pretend: GET /sources */
export async function getSources() {
  await wait()
  return [...sources]
}

/** Pretend: GET /sources/{id} */
export async function getSource(id) {
  await wait()
  const source = sources.find((item) => String(item.id) === String(id))
  if (!source) {
    throw new ApiError('Source not found (HTTP 404)', 404)
  }
  return source
}

/** Pretend: POST /sources */
export async function postSource(newSource) {
  await wait()
  const nameTaken = sources.some(
    (source) => source.name.toLowerCase() === newSource.name.toLowerCase()
  )
  if (nameTaken) {
    throw new ApiError('A source with this name already exists. (HTTP 409)', 409)
  }
  const biggestId = Math.max(0, ...sources.map((source) => source.id))
  const savedSource = { id: biggestId + 1, ...newSource, created_at: new Date().toISOString() }
  sources = [...sources, savedSource]
  return savedSource
}

// Like the real backend: add the source's name to an article
function withSourceName(article) {
  const source = sources.find((item) => item.id === article.source_id)
  return { ...article, source_name: source ? source.name : null }
}

/**
 * Pretend: GET /articles?source_id=&limit=&offset=
 * Like the real backend, list items have no "content" (only the details do).
 */
export async function getArticles({ source_id, limit, offset } = {}) {
  await wait()
  let result = articles
  if (source_id !== undefined && source_id !== null && source_id !== '') {
    result = result.filter((article) => String(article.source_id) === String(source_id))
  }
  const start = offset || 0
  const end = limit ? start + limit : undefined
  return result.slice(start, end).map((article) => {
    const summary = withSourceName(article)
    delete summary.content
    return summary
  })
}

/** Pretend: GET /articles/{id} (includes the full content) */
export async function getArticle(id) {
  await wait()
  const article = articles.find((item) => String(item.id) === String(id))
  if (!article) {
    throw new ApiError(`Article with ID ${id} not found (HTTP 404)`, 404)
  }
  return withSourceName(article)
}

/** Pretend: POST /articles */
export async function postArticle(newArticle) {
  await wait()
  const biggestId = Math.max(0, ...articles.map((article) => article.id))
  const savedArticle = {
    id: biggestId + 1,
    ...newArticle,
    retrieved_at: new Date().toISOString(),
  }
  articles = [savedArticle, ...articles]
  return savedArticle
}

/** Pretend: GET /embeddings/article/{id} */
export async function getArticleEmbeddings(articleId) {
  await wait()
  return embeddings.filter((item) => String(item.article_id) === String(articleId))
}

/** Pretend: GET /similarity/article/{id} */
export async function getSimilarArticles(
  articleId,
  { embedding_type = 'headline', limit = 10, score_threshold } = {}
) {
  await wait()
  const entry = similarityData[articleId]
  if (!entry) {
    throw new ApiError(
      `No '${embedding_type}' embedding found for article ID ${articleId}. Please generate embeddings first.`,
      404
    )
  }

  let matches = [...entry.matches]
  if (score_threshold !== undefined && score_threshold !== null) {
    matches = matches.filter((m) => m.similarity_score >= score_threshold)
  }
  if (limit) {
    matches = matches.slice(0, limit)
  }

  return {
    ...entry,
    embedding_type,
    total_matches: matches.length,
    matches,
  }
}
