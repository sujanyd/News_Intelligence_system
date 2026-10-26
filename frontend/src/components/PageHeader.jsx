import React from 'react'

/**
 * Reusable PageHeader Component
 * 
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.badge]
 * @param {React.ReactNode} [props.action]
 */
export function PageHeader({ title, description, badge, action }) {
  return (
    <div className="page-header">
      <div className="page-header-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
