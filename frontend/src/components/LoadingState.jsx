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
      <span className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default LoadingState
