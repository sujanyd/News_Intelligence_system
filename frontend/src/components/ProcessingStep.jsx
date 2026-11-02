import React from 'react'
import StatusBadge from './StatusBadge'

/**
 * Returns a default human-friendly label for a status
 */
function getDefaultBadgeLabel(status) {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'processing':
      return 'Processing'
    case 'pending':
      return 'Pending'
    case 'failed':
      return 'Failed'
    case 'unavailable':
      return 'Unavailable'
    default:
      return status
  }
}

/**
 * Returns an icon or marker for the step indicator
 */
function renderStepMarker(stepNumber, status) {
  switch (status) {
    case 'completed':
      return <span className="step-icon-check" aria-hidden="true">✓</span>
    case 'failed':
      return <span className="step-icon-failed" aria-hidden="true">✕</span>
    case 'processing':
      return <span className="step-spinner" aria-hidden="true" />
    default:
      return <span className="step-num">{stepNumber}</span>
  }
}

/**
 * ProcessingStep Component
 *
 * Represents an individual processing stage in the pipeline
 * (e.g., Collection, Preprocessing, Embeddings, Matching, AI Analysis).
 *
 * @param {Object} props
 * @param {number | string} props.stepNumber - Ordinal number (1, 2, 3...)
 * @param {string} props.title - Stage title
 * @param {'completed' | 'processing' | 'pending' | 'failed' | 'unavailable'} props.status
 * @param {string} [props.badgeLabel] - Custom badge label
 * @param {string} [props.description] - High-level description of what this stage does/did
 * @param {React.ReactNode} [props.details] - Optional extra metadata or chips
 * @param {string} [props.error] - User-facing error message (without technical secrets)
 * @param {boolean} [props.isLast=false] - Whether this is the final step
 * @param {string} [props.dataTestId] - Test identifier
 */
export function ProcessingStep({
  stepNumber,
  title,
  status = 'pending',
  badgeLabel,
  description,
  details,
  error,
  isLast = false,
  dataTestId,
}) {
  const displayLabel = badgeLabel || getDefaultBadgeLabel(status)

  return (
    <div
      className={`processing-step step-${status} ${isLast ? 'is-last-step' : ''}`}
      data-testid={dataTestId || `processing-step-${stepNumber}`}
    >
      <div className="processing-step-indicator">
        <div className={`step-marker marker-${status}`}>
          {renderStepMarker(stepNumber, status)}
        </div>
        {!isLast && <div className={`step-connector connector-${status}`} aria-hidden="true" />}
      </div>

      <div className="processing-step-content">
        <div className="processing-step-header">
          <h5 className="processing-step-title">{title}</h5>
          <StatusBadge variant={status}>{displayLabel}</StatusBadge>
        </div>

        {description && <p className="processing-step-desc">{description}</p>}

        {error && (
          <div className="processing-step-error" role="alert">
            <span className="step-error-icon" aria-hidden="true">⚠️</span>
            <span className="step-error-text">{error}</span>
          </div>
        )}

        {details && <div className="processing-step-details">{details}</div>}
      </div>
    </div>
  )
}

export default ProcessingStep
