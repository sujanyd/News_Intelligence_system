import React from 'react'
import { API_BASE_URL_LABEL } from '../api/config'
import StatusBadge from './StatusBadge'

/**
 * Sidebar Navigation Component
 * 
 * Provides accessible desktop and mobile drawer navigation with placeholders for:
 * - Dashboard
 * - Articles
 * - Sources
 * - Comparisons
 * - Reports
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Currently active route/tab
 * @param {(tab: string) => void} props.onSelectTab - Callback to switch views
 * @param {boolean} [props.isMobileOpen=false] - Whether mobile drawer is expanded
 * @param {() => void} [props.onCloseMobile] - Close callback for mobile drawer
 */
export function Sidebar({ activeTab, onSelectTab, isMobileOpen = false, onCloseMobile }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      id: 'articles',
      label: 'Articles',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
          <path d="M18 14h-8" />
          <path d="M15 18h-5" />
          <path d="M10 6h8v4h-8V6Z" />
        </svg>
      ),
    },
    {
      id: 'sources',
      label: 'Sources',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
    },
    {
      id: 'comparisons',
      label: 'Comparisons',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      ),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
    },
  ]

  const handleItemClick = (id) => {
    onSelectTab(id)
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main Navigation Sidebar"
      >
        {/* Brand / Logo Section */}
        <div className="sidebar-brand">
          <div className="brand-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">News Bias System</span>
            <span className="brand-sub">Framing & Sentiment</span>
          </div>

          {/* Close button inside mobile drawer */}
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <div className="nav-group-label">Navigation</div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                id={`nav-${item.id}`}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="nav-item-indicator" />}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="sidebar-footer">
          <div className="sidebar-api-card">
            <span className="api-card-label">Backend Target</span>
            <div className="api-card-val code-pill">{API_BASE_URL_LABEL}</div>
            <StatusBadge variant="info">FastAPI Ready</StatusBadge>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
