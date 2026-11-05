import React from 'react'
import StatusBadge from './StatusBadge'
import { PRECISION_LABELS } from '../utils/formatEventTime'

/**
 * Small badge for how precise an event's time is (event_time_precision).
 *
 * @param {Object} props
 * @param {string} props.precision - 'exact', 'date', 'range' or 'unknown'
 */
export function PrecisionBadge({ precision }) {
  const variant = precision === 'exact' ? 'success' : precision === 'unknown' ? 'neutral' : 'info'
  return <StatusBadge variant={variant}>{PRECISION_LABELS[precision] || 'Unknown'}</StatusBadge>
}

/**
 * Says whether news sources agree on when the event happened
 * (event_time_disagreement from the backend).
 *
 * @param {Object} props
 * @param {boolean} props.disagreement
 */
export function TimeAgreementBadge({ disagreement }) {
  return disagreement ? (
    <StatusBadge variant="warning">Sources disagree</StatusBadge>
  ) : (
    <StatusBadge variant="neutral">No conflict reported</StatusBadge>
  )
}
