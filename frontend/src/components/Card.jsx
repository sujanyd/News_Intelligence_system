import React from 'react'

/**
 * Reusable Card Component
 * 
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.badge]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function Card({ title, subtitle, badge, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || subtitle || badge) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

export default Card
