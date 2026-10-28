import React from 'react'
import StatusBadge from './StatusBadge'

// Badge text and colour for each value the backend can send
const AVAILABILITY_STYLES = {
  full_text: { label: 'Full text', variant: 'success' },
  summary_only: { label: 'Summary only', variant: 'info' },
  headline_only: { label: 'Headline only', variant: 'warning' },
}

/**
 * Reusable ContentAvailabilityBadge Component
 *
 * Shows how much of an article's text the system has, using the
 * backend's "content_availability" field.
 *
 * @param {Object} props
 * @param {string | null} props.availability - e.g. 'full_text'
 */
export function ContentAvailabilityBadge({ availability }) {
  if (!availability) {
    return <StatusBadge variant="primary">Not provided</StatusBadge>
  }

  // A new value we do not know yet is shown as it is
  const style = AVAILABILITY_STYLES[availability] || { label: availability, variant: 'primary' }
  return <StatusBadge variant={style.variant}>{style.label}</StatusBadge>
}

export default ContentAvailabilityBadge
