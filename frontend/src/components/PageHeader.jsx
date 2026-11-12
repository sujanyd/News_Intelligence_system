import React from 'react'

// "Thursday 12 November 2026", printed above every section's title
const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Reusable PageHeader Component
 *
 * The top of every page, set like a newspaper section front: a small
 * "Section" line with today's date between rules, the page title in a large
 * serif, and the description as the deck under it.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.badge]
 * @param {React.ReactNode} [props.action]
 */
export function PageHeader({ title, description, badge, action }) {
  return (
    <div className="page-header section-front">
      <div className="section-flag-row">
        <span className="section-flag-label">Section</span>
        <span>{TODAY_LABEL}</span>
      </div>
      <div className="page-header-top">
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        {action && <div>{action}</div>}
      </div>
      {description && <p className="page-description">{description}</p>}
    </div>
  )
}

export default PageHeader
