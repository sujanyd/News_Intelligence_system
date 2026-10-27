/**
 * News API Module
 *
 * All article and source data for the pages comes through the functions in
 * this file. The pages never call fetch() themselves, so connecting the real
 * backend later only needs changes here, not in the UI.
 *
 * Two modes:
 * - Mock mode (default): returns sample data from src/mocks/mockData.js.
 * - Live mode: calls the FastAPI backend. Turn it on with
 *   VITE_USE_MOCK_DATA=false in the .env file.
 */

import { apiGet, apiPost } from './client'
import { MOCK_ARTICLES, MOCK_SOURCES } from '../mocks/mockData'

// Mock mode is on unless .env says VITE_USE_MOCK_DATA=false
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false'

// PROPOSED endpoints. These do NOT exist in the backend yet.
// They must be confirmed with Person A (see frontend/API_CONTRACT.md).
export const ENDPOINTS = {
  articles: '/api/v1/articles',
  sources: '/api/v1/sources',
}

// Small pause in mock mode so we can see the loading state (none in tests)
const MOCK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 500

// Copies of the sample data, so adding a source does not change the original list
let mockSources = [...MOCK_SOURCES]
let mockArticles = [...MOCK_ARTICLES]

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Puts the sample data back to how it started. Used by the tests.
 */
export function resetMockData() {
  mockSources = [...MOCK_SOURCES]
  mockArticles = [...MOCK_ARTICLES]
}

/**
 * Gets the list of articles.
 *
 * @returns {Promise<Array>} list of article objects
 */
export async function fetchArticles() {
  if (USE_MOCK_DATA) {
    await wait(MOCK_DELAY_MS)
    return [...mockArticles]
  }
  return apiGet(ENDPOINTS.articles)
}

/**
 * Gets the list of news sources.
 *
 * @returns {Promise<Array>} list of source objects
 */
export async function fetchSources() {
  if (USE_MOCK_DATA) {
    await wait(MOCK_DELAY_MS)
    return [...mockSources]
  }
  return apiGet(ENDPOINTS.sources)
}

/**
 * Adds a new news source.
 *
 * @param {{ name: string, base_url: string }} newSource
 * @returns {Promise<Object>} the saved source (with its new id)
 */
export async function createSource(newSource) {
  if (USE_MOCK_DATA) {
    await wait(MOCK_DELAY_MS)

    // Source names must be unique (same rule as the database)
    const nameTaken = mockSources.some(
      (source) => source.name.toLowerCase() === newSource.name.toLowerCase()
    )
    if (nameTaken) {
      throw new Error('A source with this name already exists.')
    }

    const biggestId = Math.max(0, ...mockSources.map((source) => source.id))
    const savedSource = {
      id: biggestId + 1,
      name: newSource.name,
      base_url: newSource.base_url,
      created_at: new Date().toISOString(),
    }
    mockSources = [...mockSources, savedSource]
    return savedSource
  }
  return apiPost(ENDPOINTS.sources, newSource)
}
