/**
 * API Client Utility
 * 
 * Provides standardized request helpers for interacting with the FastAPI backend.
 * Uses getApiEndpoint so URLs are never hardcoded.
 */

import { getApiEndpoint } from './config'

/**
 * Standard HTTP GET request helper
 * 
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} [options] - Optional fetch configuration
 * @returns {Promise<any>}
 */
export async function apiGet(endpoint, options = {}) {
  const url = getApiEndpoint(endpoint)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API GET request failed with status ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Standard HTTP POST request helper
 * 
 * @param {string} endpoint - API endpoint path
 * @param {any} body - JSON payload
 * @param {RequestInit} [options] - Optional fetch configuration
 * @returns {Promise<any>}
 */
export async function apiPost(endpoint, body, options = {}) {
  const url = getApiEndpoint(endpoint)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API POST request failed with status ${response.status}: ${response.statusText}`)
  }

  return response.json()
}
