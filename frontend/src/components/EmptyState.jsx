import React from 'react'

/**
 * Reusable EmptyState Component
 * 
 * Used across dashboard, articles, comparisons, and reports to clearly
 * explain what data will appear once backend services are connected.
 * 
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Optional SVG icon
 * @param {string} props.title - Title for the empty state
 * @param {string} props.description - Detailed explanation
 * @param {React.ReactNode} [props.action] - Optional button or badge
 * @param {string} [props.className='']
 */
export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`empty-state-box ${className}`} role="status">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h4 className="empty-state-title">{title}</h4>
      <p className="empty-state-description">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}

export default EmptyState
