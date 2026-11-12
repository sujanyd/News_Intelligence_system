import React from 'react'
import StatusBadge from './StatusBadge'
import CountUp from './CountUp'

/**
 * Reusable MetricCard Component
 *
 * One number on the dashboard. While it loads it shows a shimmering
 * placeholder; then the number counts up. The badge says whether the number
 * is live backend data or not available.
 *
 * @param {Object} props
 * @param {string} props.title - Metric title (e.g., 'Total articles')
 * @param {string | number} props.value - Display value (e.g., '84' or '66 / 84')
 * @param {string} [props.subtitle] - Context label under the value
 * @param {string} [props.helperText] - Where the number comes from
 * @param {React.ReactNode} [props.icon] - Icon representing metric
 * @param {boolean} [props.isPlaceholder=true] - The value is not live backend data
 * @param {boolean} [props.isLoading=false] - Still loading: show a placeholder shimmer
 * @param {'blue'|'violet'|'cyan'|'green'|'amber'|'pink'} [props.accent='blue'] - Card colour
 * @param {string} [props.actionLabel] - Text of an optional button, e.g. "Open Reports"
 * @param {() => void} [props.onAction] - What the button does
 */
export function MetricCard({
  title,
  value,
  subtitle,
  helperText,
  icon,
  isPlaceholder = true,
  isLoading = false,
  accent = 'blue',
  actionLabel,
  onAction,
}) {
  function renderBadge() {
    if (isLoading) return <StatusBadge variant="neutral">Loading</StatusBadge>
    if (isPlaceholder) return <StatusBadge variant="info">Not available</StatusBadge>
    return <StatusBadge variant="success">Live</StatusBadge>
  }

  return (
    <div className={`card metric-card metric-accent-${accent}`} aria-busy={isLoading || undefined}>
      <div className="metric-card-top">
        <span className="metric-card-title">{title}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>

      <div className="metric-card-body">
        <div className="metric-value">
          {isLoading ? (
            <span className="skeleton skeleton-value" aria-label="Loading" />
          ) : (
            <CountUp value={value} />
          )}
        </div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>

      <div className="metric-card-footer">
        {renderBadge()}
        {helperText && <span className="metric-helper-text">{helperText}</span>}
      </div>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-secondary metric-card-action" onClick={onAction}>
          {actionLabel} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

export default MetricCard
