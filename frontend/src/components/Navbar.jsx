import React, { useState } from 'react'
import { API_BASE_URL } from '../api/config'
import StatusBadge from './StatusBadge'

/**
 * Navigation Bar Component
 * 
 * Displays the project title: "News Bias and Framing Analysis System",
 * navigation placeholders for Dashboard, Articles, Comparisons, and Reports,
 * API status indicator, and a mobile-friendly toggle.
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Currently active page/tab id
 * @param {(tab: string) => void} props.onSelectTab - Callback when a navigation tab is clicked
 */
export function Navbar({ activeTab, onSelectTab }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'articles', label: 'Articles', icon: '📰' },
    { id: 'comparisons', label: 'Comparisons', icon: '⚖️' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ]

  const handleTabClick = (id) => {
    onSelectTab(id)
    setIsMobileMenuOpen(false)
  }

  return (
    <header className="app-header">
      <div className="nav-wrapper">
        <div className="brand-section">
          <div className="brand-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="brand-title">News Bias and Framing Analysis System</span>
            <span className="brand-subtitle">AI Intelligence & Perspective Platform</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="nav-links" aria-label="Main Navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              id={`nav-${item.id}`}
              className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side items */}
        <div className="nav-right-items">
          <StatusBadge variant="info" className="api-status-badge">
            API: {API_BASE_URL}
          </StatusBadge>

          {/* Mobile menu toggle button */}
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMobileMenuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 12h16M4 6h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      <div className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            id={`mobile-nav-${item.id}`}
            className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleTabClick(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  )
}

export default Navbar
