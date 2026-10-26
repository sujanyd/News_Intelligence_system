/**
 * API Configuration Module
 * 
 * Configures the backend API base URL using Vite environment variables.
 * Defaults to FastAPI default port (http://localhost:8000) during local development.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Resolves a full backend URL for a given relative endpoint path.
 * Ensures proper slash handling.
 * 
 * @param {string} path - Relative API route (e.g., '/health' or 'api/v1/status')
 * @returns {string} Fully qualified API URL
 */
export function getApiEndpoint(path = '') {
  const cleanBase = API_BASE_URL.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase
}
