import React from 'react'
import StatusBadge from './StatusBadge'
import { USE_MOCK_DATA } from '../api/newsApi'

/**
 * Reusable DataModeBadge Component
 *
 * Tells the user whether the page shows sample (mock) data or real data
 * from the backend, so the two are never confused.
 */
export function DataModeBadge() {
  if (USE_MOCK_DATA) {
    return <StatusBadge variant="warning">Mock data</StatusBadge>
  }
  return <StatusBadge variant="success">Live API</StatusBadge>
}

export default DataModeBadge
