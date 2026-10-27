/**
 * API Configuration Module
 *
 * Reads the backend settings from Vite environment variables (frontend/.env).
 *
 * IMPORTANT: every VITE_ variable is copied into the browser code, so anyone
 * can read it. Never put passwords, API keys or other secrets in them.
 */

// Address of the FastAPI backend, e.g. http://localhost:8000
// There is no default on purpose: if it is missing, the app says so clearly.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim()

// Text to show in the UI when the address is missing
export const API_BASE_URL_LABEL = API_BASE_URL || 'Not configured'

// Path that comes before /sources and /articles.
// The plan says "/api"; the backend currently uses "/api/v1" for versioned routes.
// Change it in .env once Person A confirms the real routes.
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api'

/**
 * Joins the base URL and a path, making sure there is exactly one "/" between them.
 *
 * @param {string} path - Relative API route (e.g., '/health' or 'api/sources')
 * @returns {string} Full URL, e.g. "http://localhost:8000/api/sources"
 */
export function getApiEndpoint(path = '') {
  const cleanBase = API_BASE_URL.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase
}
