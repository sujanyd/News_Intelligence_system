import React from 'react'

/**
 * Reusable AlertMessage Component
 *
 * A coloured message box for errors, success messages, warnings and notes.
 *
 * @param {Object} props
 * @param {'error' | 'success' | 'warning' | 'info'} [props.type='error'] - Colour and meaning
 * @param {string} [props.title] - Bold text at the start
 * @param {string} props.message - Main text
 * @param {() => void} [props.onRetry] - If given, shows a "Try again" button
 */
export function AlertMessage({ type = 'error', title, message, onRetry }) {
  // Errors are read out at once by screen readers; other messages wait politely
  const role = type === 'error' ? 'alert' : 'status'

  return (
    <div className={`alert-banner ${type}`} role={role}>
      <div className="alert-text">
        {title && <strong>{title} </strong>}
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export default AlertMessage
