import React from 'react'
import { API_BASE_URL_LABEL } from '../api/config'
import StatusBadge from './StatusBadge'
import ThemeToggle from './ThemeToggle'

/**
 * Top Application Header Component
 * 
 * Displays the project title: "News Bias and Framing Analysis System",
 * active page breadcrumb, light/dark theme button, API status pill, and
 * mobile drawer toggle button.
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Currently active tab
 * @param {() => void} props.onToggleMobileMenu - Toggle mobile sidebar drawer
 * @param {() => void} [props.onOpenPalette] - Open the quick jump box (Ctrl+K)
 */
export function Header({ activeTab, onToggleMobileMenu, onOpenPalette }) {
  const getTabLabel = (id) => {
    switch (id) {
      case 'dashboard':
        return 'Dashboard'
      case 'articles':
        return 'Articles'
      case 'stories':
        return 'Stories'
      case 'sources':
        return 'Sources'
      case 'comparisons':
        return 'Comparisons'
      case 'reports':
        return 'Reports'
      default:
        return 'Dashboard'
    }
  }

  return (
    <header className="app-top-header">
      <div className="header-left">
        {/* Mobile menu hamburger toggle */}
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h16M4 6h16M4 18h16" />
          </svg>
        </button>

        {/* Project Brand & Breadcrumb */}
        <div className="header-title-section">
          <h2 className="header-project-title">News Bias and Framing Analysis System</h2>
          <div className="header-breadcrumb">
            <span className="crumb-root">Platform</span>
            <span className="crumb-separator">/</span>
            <span className="crumb-active">{getTabLabel(activeTab)}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        {onOpenPalette && (
          <button
            type="button"
            className="btn btn-secondary palette-trigger"
            onClick={onOpenPalette}
            aria-label="Jump to a page (Ctrl+K)"
          >
            <span aria-hidden="true">⌕</span>
            <span className="palette-trigger-text">Jump to…</span>
            <kbd className="palette-kbd">Ctrl K</kbd>
          </button>
        )}
        <ThemeToggle />
        <StatusBadge variant="info" className="header-api-badge">
          API: {API_BASE_URL_LABEL}
        </StatusBadge>
      </div>
    </header>
  )
}

export default Header
