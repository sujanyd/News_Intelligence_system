import React from 'react'
import StatusBadge from './StatusBadge'
import { formatTechnique, PRESENTATION_LABELS } from '../utils/politicalLabels'

/**
 * Coloured badge for how a political entity is worded:
 * green = favorable, red = critical, amber = mixed, grey = no clear signal.
 *
 * @param {Object} props
 * @param {string} props.presentation - 'favorable', 'unfavorable', 'mixed' or 'neutral'
 */
export function PresentationBadge({ presentation }) {
  const { label, variant } = PRESENTATION_LABELS[presentation] || PRESENTATION_LABELS.neutral
  return <StatusBadge variant={variant}>{label}</StatusBadge>
}

/**
 * One presentation signal: the category on top (badge and technique), then
 * the article's own sentence as evidence, then the backend's reason.
 * The category and the evidence are kept visibly apart.
 *
 * @param {Object} props
 * @param {Object} props.signal - from toPoliticalAnalysis
 * @param {boolean} [props.showEntity=true] - show the entity name in the header
 */
export function PoliticalSignalItem({ signal, showEntity = true }) {
  return (
    <li className={`pol-signal pol-signal-${signal.treatment}`}>
      <div className="pol-signal-header">
        {showEntity && <strong>{signal.entity_name}</strong>}
        <PresentationBadge presentation={signal.treatment} />
        <span className="pol-technique">Category: {formatTechnique(signal.framing_technique)}</span>
      </div>
      <p className="pol-evidence-label">Evidence from the article</p>
      <blockquote className="pol-evidence">“{signal.evidence_text}”</blockquote>
      {signal.explanation && <p className="pol-explanation">Why: {signal.explanation}</p>}
    </li>
  )
}
