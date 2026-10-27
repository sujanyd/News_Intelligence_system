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
 * contentStatus is:
 *   'available' - the article has text
 *   'missing'   - the text is empty or null
 *   'unknown'   - the reply did not include the content field at all
 */
export function toArticle(raw) {
  if (!isObject(raw) || raw.id === undefined || raw.id === null || typeof raw.title !== 'string') {
    throw new ApiError('The backend sent an article in an unexpected format.')
  }

  let contentStatus = 'unknown'
  if ('content' in raw) {
    contentStatus = typeof raw.content === 'string' && raw.content.trim() !== '' ? 'available' : 'missing'
  }

  return {
    id: raw.id,
    title: raw.title,
    source_id: raw.source_id ?? null,
    // The Article model has no source name, only source_id; the page looks the name up
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null,
    url: typeof raw.url === 'string' ? raw.url : '',
    published_at: raw.published_at ?? null,
    retrieved_at: raw.retrieved_at ?? null,
    content: typeof raw.content === 'string' ? raw.content : null,
    contentStatus,
  }
}
