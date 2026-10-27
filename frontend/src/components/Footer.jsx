import React from 'react'
import { API_BASE_URL_LABEL } from '../api/config'

/**
 * Application Footer Component
 */
export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <span>News Bias and Framing Analysis System</span>
          <span>•</span>
          <span>College Capstone Project</span>
        </div>
        <div className="footer-right">
          <span>Configured Backend:</span>
          <span className="code-pill">{API_BASE_URL_LABEL}</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
