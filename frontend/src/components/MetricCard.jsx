import React from 'react'
import StatusBadge from './StatusBadge'

/**
 * Reusable MetricCard Component
 * 
 * Displays key metrics on the dashboard with clear indicators that
 * distinguish placeholders from live backend-collected data.
 * 
 * @param {Object} props
 * @param {string} props.title - Metric title (e.g., 'Total articles')
 * @param {string | number} props.value - Display value (e.g., '--' or '0')
 * @param {string} [props.subtitle] - Context label under the value
 * @param {string} [props.helperText] - Subtext explaining pipeline integration
 * @param {React.ReactNode} [props.icon] - Icon representing metric
 * @param {boolean} [props.isPlaceholder=true] - Marks card with a placeholder pill
 */
export function MetricCard({
  title,
  value,
  subtitle,
  helperText,
  icon,
  isPlaceholder = true,
}) {
  return (
    <div className="card metric-card">
      <div className="metric-card-top">
        <span className="metric-card-title">{title}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>

      <div className="metric-card-body">
        <div className="metric-value">{value}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>

      <div className="metric-card-footer">
        {isPlaceholder ? (
          <StatusBadge variant="info">Awaiting API</StatusBadge>
        ) : (
          <StatusBadge variant="success">Live</StatusBadge>
        )}
        {helperText && <span className="metric-helper-text">{helperText}</span>}
      </div>
    </div>
  )
}

export default MetricCard
