import React from 'react'

/**
 * Reusable Status Badge Component
 * 
 * @param {Object} props
 * @param {'primary' | 'success' | 'warning' | 'info'} [props.variant='primary']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function StatusBadge({ variant = 'primary', children, className = '' }) {
  return (
    <span className={`status-badge ${variant} ${className}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}

export default StatusBadge
