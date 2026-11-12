import React from 'react'

/**
 * Reusable LoadingState Component
 *
 * Shows a spinning circle and a short message while data is loading.
 *
 * @param {Object} props
 * @param {string} [props.message='Loading...'] - Text shown next to the spinner
 */
export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state" role="status">
      {/* An ink roller running along a rule, instead of a spinning wheel */}
      <span className="loading-roller" aria-hidden="true">
        <span className="loading-roller-ink" />
      </span>
      {/* Typed out like a wire-service teletype (CSS steps over --chars) */}
      <span className="loading-message" style={{ '--chars': message.length }}>
        {message}
      </span>
    </div>
  )
}

export default LoadingState
