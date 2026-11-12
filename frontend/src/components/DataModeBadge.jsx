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
  // Real data is the normal case and needs no label; only mock data is flagged
  return null
}

export default DataModeBadge
