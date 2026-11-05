/**
 * Response Checking ("normalizing")
 *
 * The backend is still being built, so its replies might not look exactly as
 * planned. These functions check each reply and turn it into the shape the
 * pages use. If a reply is broken, they throw an ApiError instead of
 * showing wrong data.
 *
 * Field names follow the database models (app/models/*.py).
 */

import { ApiError } from './client'

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * A list reply can be a plain array:      [ {...}, {...} ]
 * or an object with the items and total:  { "items": [...], "total": 42 }
 * (Which one the backend uses is still to be confirmed with Person A.)
 *
 * @returns {{ items: Array, total: number | null }}
 */
export function toList(data, thingName) {
  if (Array.isArray(data)) {
    return { items: data, total: null }
  }
  if (isObject(data) && Array.isArray(data.items)) {
    const total = Number.isInteger(data.total) ? data.total : null
    return { items: data.items, total }
  }
  throw new ApiError(`The backend sent the ${thingName} list in an unexpected format.`)
}

/**
 * Checks one news source.
 * Required: id and name. Optional: base_url, created_at.
 */
export function toSource(raw) {
  if (!isObject(raw) || raw.id === undefined || raw.id === null || typeof raw.name !== 'string') {
    throw new ApiError('The backend sent a news source in an unexpected format.')
  }
  return {
    id: raw.id,
    name: raw.name,
    base_url: typeof raw.base_url === 'string' ? raw.base_url : '',
    created_at: raw.created_at ?? null,
  }
}

/**
 * Checks one article.
 * Required: id and title. Everything else is optional.
 *
 * content_availability comes from the backend as
 * 'full_text', 'summary_only' or 'headline_only' (null if it is missing).
 * The article list does not include "content"; only GET /articles/{id} does.
 */
export function toArticle(raw) {
  if (!isObject(raw) || raw.id === undefined || raw.id === null || typeof raw.title !== 'string') {
    throw new ApiError('The backend sent an article in an unexpected format.')
  }

  return {
    id: raw.id,
    title: raw.title,
    source_id: raw.source_id ?? null,
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null,
    // The event this article reports (null when it is not in a story yet)
    event_id: Number.isInteger(raw.event_id) ? raw.event_id : null,
    url: typeof raw.url === 'string' ? raw.url : '',
    published_at: raw.published_at ?? null,
    retrieved_at: raw.retrieved_at ?? null,
    content_availability:
      typeof raw.content_availability === 'string' ? raw.content_availability : null,
    content: typeof raw.content === 'string' ? raw.content : null,
  }
}

// The numbers POST /ingestion/run reports (app/schemas/ingestion.py), and their labels
export const INGESTION_COUNT_LABELS = {
  feeds_attempted: 'Feeds attempted',
  feeds_successful: 'Feeds processed successfully',
  articles_inserted: 'New articles inserted',
  articles_skipped_duplicate: 'Duplicate articles skipped',
  feed_errors: 'Feed errors',
}

/**
 * Checks the reply of one news collection run.
 * Keeps only the counts the backend really sent, so nothing is made up.
 *
 * "details" has one entry per feed:
 *   { source_name, feed_url, status: 'success' | 'error',
 *     articles_inserted, articles_skipped_duplicate, error }
 *
 * @returns {{ counts: Array<{ key: string, label: string, value: number }>, feeds: Array }}
 */
export function toIngestionResult(raw) {
  if (!isObject(raw)) {
    throw new ApiError('The backend sent the news collection result in an unexpected format.')
  }

  const counts = []
  for (const key of Object.keys(INGESTION_COUNT_LABELS)) {
    if (Number.isInteger(raw[key])) {
      counts.push({ key, label: INGESTION_COUNT_LABELS[key], value: raw[key] })
    }
  }

  const details = Array.isArray(raw.details) ? raw.details.filter(isObject) : []
  const feeds = details.map((feed, index) => ({
    id: index, // DataTable needs an id for each row
    source_name: typeof feed.source_name === 'string' ? feed.source_name : 'Unknown feed',
    feed_url: typeof feed.feed_url === 'string' ? feed.feed_url : '',
    status: typeof feed.status === 'string' ? feed.status : null,
    articles_inserted: Number.isInteger(feed.articles_inserted) ? feed.articles_inserted : null,
    articles_skipped_duplicate: Number.isInteger(feed.articles_skipped_duplicate)
      ? feed.articles_skipped_duplicate
      : null,
    error: typeof feed.error === 'string' ? feed.error : null,
  }))

  return { counts, feeds }
}

/**
 * Checks an individual article embedding result.
 * Matches backend ArticleEmbeddingResultDetail schema (app/schemas/embedding.py).
 */
export function toEmbeddingResult(raw) {
  if (
    !isObject(raw) ||
    raw.article_id === undefined ||
    raw.article_id === null ||
    typeof raw.embedding_type !== 'string' ||
    typeof raw.status !== 'string'
  ) {
    throw new ApiError('The backend sent an article embedding result in an unexpected format.')
  }

  return {
    article_id: raw.article_id,
    embedding_type: raw.embedding_type,
    status: raw.status,
    model_name: typeof raw.model_name === 'string' ? raw.model_name : 'unknown',
    vector_reference: typeof raw.vector_reference === 'string' ? raw.vector_reference : null,
    dimensions: Number.isInteger(raw.dimensions) ? raw.dimensions : null,
    error: typeof raw.error === 'string' ? raw.error : null,
  }
}

/**
 * Checks a list of article embedding results.
 * Endpoint: GET /api/v1/embeddings/article/{article_id}
 */
export function toEmbeddingResultList(raw) {
  if (!Array.isArray(raw)) {
    throw new ApiError('The backend sent the embedding list in an unexpected format.')
  }
  return raw.map(toEmbeddingResult)
}

/**
 * Checks an individual similar article match.
 * Matches backend ArticleSimilarityMatch schema (app/services/similarity.py).
 */
export function toSimilarArticleMatch(raw) {
  if (
    !isObject(raw) ||
    raw.article_id === undefined ||
    raw.article_id === null ||
    typeof raw.similarity_score !== 'number'
  ) {
    throw new ApiError('The backend sent a similar article match in an unexpected format.')
  }

  return {
    article_id: raw.article_id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled article',
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null,
    source_id: raw.source_id ?? null,
    url: typeof raw.url === 'string' ? raw.url : '',
    published_at: raw.published_at ?? null,
    similarity_score: raw.similarity_score,
    embedding_type: typeof raw.embedding_type === 'string' ? raw.embedding_type : 'headline',
    model_name: typeof raw.model_name === 'string' ? raw.model_name : 'unknown',
    vector_id: typeof raw.vector_id === 'string' ? raw.vector_id : '',
  }
}

/**
 * Checks a similar articles response.
 * Matches backend ArticleSimilarityResponse schema (app/services/similarity.py).
 * Endpoint: GET /api/v1/similarity/article/{article_id}
 */
export function toSimilarArticlesResponse(raw) {
  if (!isObject(raw) || !Array.isArray(raw.matches)) {
    throw new ApiError('The backend sent the similarity results in an unexpected format.')
  }

  return {
    query_article_id: raw.query_article_id ?? null,
    query_title: typeof raw.query_title === 'string' ? raw.query_title : null,
    embedding_type: typeof raw.embedding_type === 'string' ? raw.embedding_type : 'headline',
    model_name: typeof raw.model_name === 'string' ? raw.model_name : 'unknown',
    total_matches: Number.isInteger(raw.total_matches) ? raw.total_matches : raw.matches.length,
    matches: raw.matches.map(toSimilarArticleMatch),
  }
}

export const VALID_MATCH_LABELS = ['SAME', 'RELATED', 'DIFFERENT']

/**
 * Checks an individual article match pair with classification label.
 * Matches backend ArticleMatch model (app/models/article_match.py).
 * 
 * Supports both nested relationship objects (`article_1`, `article_2`)
 * and flattened pair structures.
 */
export function toArticleMatch(raw) {
  if (!isObject(raw)) {
    throw new ApiError('The backend sent an article match pair in an unexpected format.')
  }

  // Canonical article IDs
  const articleId1 = raw.article_id_1 ?? raw.article_id_a ?? raw.query_article_id ?? raw.article_1?.id
  const articleId2 = raw.article_id_2 ?? raw.article_id_b ?? raw.matched_article_id ?? raw.article_2?.id

  if (articleId1 === undefined || articleId1 === null || articleId2 === undefined || articleId2 === null) {
    throw new ApiError('The backend sent a match pair missing required article IDs.')
  }

  // Validate classification label: SAME, RELATED, DIFFERENT
  const rawLabel = typeof raw.match_label === 'string' ? raw.match_label.trim().toUpperCase() : null
  if (!rawLabel || !VALID_MATCH_LABELS.includes(rawLabel)) {
    throw new ApiError('Invalid match classification label: expected SAME, RELATED, or DIFFERENT.')
  }

  // Article A metadata
  const rawArtA = isObject(raw.article_1) ? raw.article_1 : (isObject(raw.article_a) ? raw.article_a : {})
  const articleA = {
    id: articleId1,
    title:
      typeof rawArtA.title === 'string'
        ? rawArtA.title
        : typeof raw.article_1_title === 'string'
        ? raw.article_1_title
        : typeof raw.article_a_title === 'string'
        ? raw.article_a_title
        : typeof raw.title_1 === 'string'
        ? raw.title_1
        : 'Untitled article',
    source_name:
      typeof rawArtA.source_name === 'string'
        ? rawArtA.source_name
        : typeof rawArtA.source?.name === 'string'
        ? rawArtA.source.name
        : typeof raw.article_1_source === 'string'
        ? raw.article_1_source
        : typeof raw.source_name_a === 'string'
        ? raw.source_name_a
        : typeof raw.source_1 === 'string'
        ? raw.source_1
        : null,
    source_id: rawArtA.source_id ?? raw.source_id_a ?? null,
    published_at: rawArtA.published_at ?? raw.published_at_a ?? raw.published_at_1 ?? null,
    content:
      typeof rawArtA.content === 'string'
        ? rawArtA.content
        : typeof raw.content_a === 'string'
        ? raw.content_a
        : null,
    content_availability:
      typeof rawArtA.content_availability === 'string'
        ? rawArtA.content_availability
        : typeof raw.content_availability_a === 'string'
        ? raw.content_availability_a
        : null,
    url:
      typeof rawArtA.url === 'string'
        ? rawArtA.url
        : typeof raw.url_a === 'string'
        ? raw.url_a
        : '',
  }

  // Article B metadata
  const rawArtB = isObject(raw.article_2) ? raw.article_2 : (isObject(raw.article_b) ? raw.article_b : {})
  const articleB = {
    id: articleId2,
    title:
      typeof rawArtB.title === 'string'
        ? rawArtB.title
        : typeof raw.article_2_title === 'string'
        ? raw.article_2_title
        : typeof raw.article_b_title === 'string'
        ? raw.article_b_title
        : typeof raw.title_2 === 'string'
        ? raw.title_2
        : typeof raw.title === 'string'
        ? raw.title
        : 'Untitled article',
    source_name:
      typeof rawArtB.source_name === 'string'
        ? rawArtB.source_name
        : typeof rawArtB.source?.name === 'string'
        ? rawArtB.source.name
        : typeof raw.article_2_source === 'string'
        ? raw.article_2_source
        : typeof raw.source_name_b === 'string'
        ? raw.source_name_b
        : typeof raw.source_name === 'string'
        ? raw.source_name
        : null,
    source_id: rawArtB.source_id ?? raw.source_id_b ?? raw.source_id ?? null,
    published_at:
      rawArtB.published_at ?? raw.published_at_b ?? raw.published_at_2 ?? raw.published_at ?? null,
    content:
      typeof rawArtB.content === 'string'
        ? rawArtB.content
        : typeof raw.content_b === 'string'
        ? raw.content_b
        : null,
    content_availability:
      typeof rawArtB.content_availability === 'string'
        ? rawArtB.content_availability
        : typeof raw.content_availability_b === 'string'
        ? raw.content_availability_b
        : null,
    url:
      typeof rawArtB.url === 'string'
        ? rawArtB.url
        : typeof raw.url_b === 'string'
        ? raw.url_b
        : typeof raw.url === 'string'
        ? raw.url
        : '',
  }

  return {
    id: raw.id ?? `${articleId1}_${articleId2}`,
    article_id_1: articleId1,
    article_id_2: articleId2,
    article_a: articleA,
    article_b: articleB,
    match_label: rawLabel,
    similarity_score: typeof raw.similarity_score === 'number' ? raw.similarity_score : null,
    confidence_score: typeof raw.confidence_score === 'number' ? raw.confidence_score : null,
    model_name: typeof raw.model_name === 'string' ? raw.model_name : null,
    review_status:
      typeof raw.review_status === 'string' ? raw.review_status.toLowerCase() : 'unreviewed',
    reviewed_at: raw.reviewed_at ?? null,
    reviewer_notes: typeof raw.reviewer_notes === 'string' ? raw.reviewer_notes : null,
    created_at: raw.created_at ?? null,
  }
}

/**
 * Checks a list of article matches.
 * @param {any} raw
 * @returns {Array<Object>}
 */
export function toArticleMatchList(raw) {
  if (Array.isArray(raw)) {
    return raw.map(toArticleMatch)
  }
  if (isObject(raw) && Array.isArray(raw.items)) {
    return raw.items.map(toArticleMatch)
  }
  if (isObject(raw) && Array.isArray(raw.matches)) {
    return raw.matches.map(toArticleMatch)
  }
  throw new ApiError('The backend sent the article matches list in an unexpected format.')
}


/**
 * Checks the reply of POST /articles/{id}/match (ArticleMatchSummaryResponse
 * in app/schemas/article_match.py).
 *
 * @returns {{ query_article_id: number, candidates_retrieved: number,
 *   matches_created: number, matches_updated: number, matches_skipped: number,
 *   matches: Array }}
 */
export function toMatchRunSummary(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.candidates_retrieved)) {
    throw new ApiError('The backend sent the matching result in an unexpected format.')
  }
  const count = (value) => (Number.isInteger(value) ? value : 0)
  return {
    query_article_id: raw.query_article_id ?? null,
    candidates_retrieved: raw.candidates_retrieved,
    matches_created: count(raw.matches_created),
    matches_updated: count(raw.matches_updated),
    matches_skipped: count(raw.matches_skipped),
    matches: Array.isArray(raw.matches) ? raw.matches.map(toArticleMatch) : [],
  }
}

// ---------------------------------------------------------------------------
// Stories and events (app/schemas/story_event.py)
//
// A story is one news topic. An event is one thing that happened inside a
// story. Each article belongs to at most one event.
// The backend has NO story description and NO event title, so these
// functions do not make one up.
// ---------------------------------------------------------------------------

// The values event_time_precision can have
export const EVENT_TIME_PRECISIONS = ['exact', 'date', 'range', 'unknown']

// A count from the backend, or 0 when it is missing
function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}

// A list of articles inside a story or event reply (missing = empty list)
function toArticleArray(value) {
  return Array.isArray(value) ? value.map(toArticle) : []
}

/**
 * Checks one event.
 * Required: id. event_time may be null. Unknown precision values become 'unknown'.
 */
export function toEvent(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.id)) {
    throw new ApiError('The backend sent an event in an unexpected format.')
  }
  return {
    id: raw.id,
    story_id: Number.isInteger(raw.story_id) ? raw.story_id : null,
    story_title: typeof raw.story_title === 'string' ? raw.story_title : null,
    event_time: typeof raw.event_time === 'string' ? raw.event_time : null,
    event_time_precision: EVENT_TIME_PRECISIONS.includes(raw.event_time_precision)
      ? raw.event_time_precision
      : 'unknown',
    event_time_disagreement: raw.event_time_disagreement === true,
    article_count: toCount(raw.article_count),
    // Only GET /events/{id} sends the articles
    articles: toArticleArray(raw.articles),
  }
}

/**
 * Checks one story.
 * Required: id and title. GET /stories/{id} also sends events and articles.
 */
export function toStory(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.id) || typeof raw.title !== 'string') {
    throw new ApiError('The backend sent a story in an unexpected format.')
  }
  return {
    id: raw.id,
    title: raw.title,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
    event_count: toCount(raw.event_count),
    article_count: toCount(raw.article_count),
    events: Array.isArray(raw.events) ? raw.events.map(toEvent) : [],
    articles: toArticleArray(raw.articles),
  }
}

/**
 * Checks the reply of POST /stories/group/batch: one result per article.
 * Adds up how many stories and events were created or reused.
 *
 * @returns {{ articlesGrouped: number, storiesCreated: number, storiesReused: number,
 *   eventsCreated: number, eventsReused: number }}
 */
export function toGroupingSummary(raw) {
  if (!Array.isArray(raw)) {
    throw new ApiError('The backend sent the grouping result in an unexpected format.')
  }
  const summary = {
    articlesGrouped: raw.length,
    storiesCreated: 0,
    storiesReused: 0,
    eventsCreated: 0,
    eventsReused: 0,
  }
  for (const result of raw) {
    if (!isObject(result)) {
      throw new ApiError('The backend sent the grouping result in an unexpected format.')
    }
    if (result.story_action === 'created') summary.storiesCreated += 1
    if (result.story_action === 'reused') summary.storiesReused += 1
    if (result.event_action === 'created') summary.eventsCreated += 1
    if (result.event_action === 'reused') summary.eventsReused += 1
  }
  return summary
}
