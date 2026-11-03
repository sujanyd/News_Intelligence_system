import React from 'react'

/**
 * ClassificationBadge Component
 *
 * Visually distinguishes article matching classification labels:
 *   - SAME: Articles cover identical underlying news event.
 *   - RELATED: Articles share themes, entities, or related contexts.
 *   - DIFFERENT: Articles cover unrelated events/subjects.
 *
 * NOTE: As per strict project requirements:
 *   - Do NOT use similarity scores as classification labels.
 *   - Classification labels are discrete categories (SAME, RELATED, DIFFERENT).
 *
 * @param {Object} props
 * @param {string} props.label - 'SAME' | 'RELATED' | 'DIFFERENT'
 * @param {string} [props.className] - Optional extra CSS class
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Badge sizing
 */
export function ClassificationBadge({ label, className = '', size = 'md' }) {
  const normalizedLabel = typeof label === 'string' ? label.trim().toUpperCase() : ''

  let config = {
    className: 'badge-classification-unknown',
    symbol: '?',
    text: normalizedLabel || 'UNKNOWN',
    description: 'Unclassified article pair',
  }

  if (normalizedLabel === 'SAME') {
    config = {
      className: 'badge-classification-same',
      symbol: '=',
      text: 'SAME',
      description: 'System classified as covering the same core event',
    }
  } else if (normalizedLabel === 'RELATED') {
    config = {
      className: 'badge-classification-related',
      symbol: '≈',
      text: 'RELATED',
      description: 'System classified as semantically related or topical context',
    }
  } else if (normalizedLabel === 'DIFFERENT') {
    config = {
      className: 'badge-classification-different',
      symbol: '≠',
      text: 'DIFFERENT',
      description: 'System classified as covering distinct, unrelated subjects',
    }
  }

  return (
    <span
      className={`classification-badge ${config.className} classification-badge-${size} ${className}`.trim()}
      title={config.description}
      data-testid={`classification-badge-${normalizedLabel.toLowerCase() || 'unknown'}`}
      data-label={normalizedLabel}
    >
      <span className="cb-symbol" aria-hidden="true">
        {config.symbol}
      </span>
      <span className="cb-text">{config.text}</span>
    </span>
  )
}

export default ClassificationBadge
