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
    url: typeof raw.url === 'string' ? raw.url : '',
    published_at: raw.published_at ?? null,
    retrieved_at: raw.retrieved_at ?? null,
    content_availability:
      typeof raw.content_availability === 'string' ? raw.content_availability : null,
    content: typeof raw.content === 'string' ? raw.content : null,
  }
}

// The numbers a news collection run may report, and how the dashboard labels them.
// PROPOSED names only: the backend has no collection endpoint yet (see API_CONTRACT.md).
export const INGESTION_COUNT_LABELS = {
  feeds_attempted: 'Feeds attempted',
  feeds_succeeded: 'Feeds processed successfully',
  articles_inserted: 'New articles inserted',
  duplicates_skipped: 'Duplicate articles skipped',
}

/**
 * Checks the reply of one news collection run.
 * Keeps only the counts the backend really sent, so nothing is made up.
 *
 * @returns {{ counts: Array<{ key: string, label: string, value: number }>, errors: string[] | null }}
 *   errors is null when the backend did not send any error information
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

  // Feed errors: a list of messages (text, or objects with a "message")
  let errors = null
  if (Array.isArray(raw.errors)) {
    errors = raw.errors.map((item) => {
      if (typeof item === 'string') return item
      if (isObject(item) && typeof item.message === 'string') return item.message
      return JSON.stringify(item)
    })
  }

  return { counts, errors }
}
