import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { API_BASE_URL } from '../api/config'

/**
 * Dashboard Page Placeholder
 */
export function Dashboard() {
  return (
    <div className="page-dashboard">
      <PageHeader
        title="Dashboard"
        description="High-level overview of news ingestion, topic clustering, and media framing metrics."
        badge={<StatusBadge variant="success">Frontend Initialized</StatusBadge>}
      />

      {/* Overview Metric Cards */}
      <div className="grid-cards">
        <Card title="Ingestion Pipeline" subtitle="Data aggregation status">
          <div className="metric-value">Ready</div>
          <div className="metric-label">Awaiting FastAPI ingestion service</div>
        </Card>

        <Card title="Framing Analysis" subtitle="NLP model connection">
          <div className="metric-value">Configured</div>
          <div className="metric-label">Base URL: {API_BASE_URL}</div>
        </Card>

        <Card title="Monitored Sources" subtitle="Publishers & RSS Feeds">
          <div className="metric-value">Multi-Source</div>
          <div className="metric-label">National, international & independent feeds</div>
        </Card>
      </div>

      {/* Integration Notice & System Pipeline */}
      <Card
        title="System Architecture & Backend Readiness"
        subtitle="Preparation for FastAPI REST API endpoints"
        badge={<StatusBadge variant="primary">Architecture Ready</StatusBadge>}
      >
        <p style={{ marginBottom: '1rem' }}>
          The frontend interface is organized with modular components and an API abstraction layer.
          When the FastAPI backend endpoints are finalized, data will populate this dashboard in real time.
        </p>

        <div className="placeholder-box">
          <div className="placeholder-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h4 className="placeholder-title">Live Metrics Stream Awaiting Backend Connection</h4>
          <p className="placeholder-text">
            Configured API Base URL: <span className="code-pill">{API_BASE_URL}</span>.
            Actual live article clustering and sentiment calculations will be connected once backend routes are deployed.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Dashboard
