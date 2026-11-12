import React from 'react'

/**
 * Stamp Component
 *
 * A rubber-stamp mark that "thumps" onto the page, like an editor's
 * stamp on a printed proof. Used only for facts the backend states, e.g. a
 * report was saved (with its date) or an article was flagged for review.
 *
 * @param {Object} props
 * @param {string} props.label - e.g. "Filed"
 * @param {string} [props.detail] - small second line, e.g. a date
 * @param {'red' | 'ink'} [props.tone='red']
 */
export function Stamp({ label, detail, tone = 'red' }) {
  return (
    <span className={`stamp stamp-${tone}`} role="img" aria-label={detail ? `${label}, ${detail}` : label}>
      <span className="stamp-label" aria-hidden="true">
        {label}
      </span>
      {detail && (
        <span className="stamp-detail" aria-hidden="true">
          {detail}
        </span>
      )}
    </span>
  )
}

export default Stamp
