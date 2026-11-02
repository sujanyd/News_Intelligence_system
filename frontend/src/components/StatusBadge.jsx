import React from 'react'

/**
 * Normalizes state names to class names
 */
const VARIANT_MAP = {
  completed: 'success',
  processing: 'info processing',
  pending: 'warning',
  failed: 'danger',
  unavailable: 'neutral',
  // standard theme variants
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  info: 'info',
  danger: 'danger',
  neutral: 'neutral',
}

/**
 * Reusable Status Badge Component
 *
 * Supports pipeline and workflow states:
 *   - 'completed'   (success / green)
 *   - 'processing'  (info / cyan with pulsing dot)
 *   - 'pending'     (warning / amber)
 *   - 'failed'      (danger / red)
 *   - 'unavailable' (neutral / muted gray)
 *
 * As well as standard design system variants:
 *   - 'primary', 'success', 'warning', 'info', 'danger', 'neutral'
 *
 * @param {Object} props
 * @param {string} [props.variant='primary']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function StatusBadge({ variant = 'primary', children, className = '' }) {
  const resolvedClass = VARIANT_MAP[variant] || variant

  return (
    <span className={`status-badge ${resolvedClass} ${className}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}

export default StatusBadge
