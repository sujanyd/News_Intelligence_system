import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

/**
 * Articles Page Placeholder
 */
export function Articles() {
  return (
    <div className="page-articles">
      <PageHeader
        title="Articles"
        description="Ingested articles repository with metadata, semantic tags, and framing indicators."
        badge={<StatusBadge variant="info">Feed View</StatusBadge>}
      />

      <Card
        title="Article Intelligence Stream"
        subtitle="Search, filter, and review analyzed news articles"
        badge={<StatusBadge variant="warning">Awaiting API</StatusBadge>}
      >
        <p style={{ marginBottom: '1rem' }}>
          This section will display real-time news articles harvested across multiple sources.
          Filters for publisher, sentiment score, framing angle, and publication date will appear here.
        </p>

        <div className="placeholder-box">
          <div className="placeholder-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
          </div>
          <h4 className="placeholder-title">Articles Feed Placeholder</h4>
          <p className="placeholder-text">
            No mock backend endpoints have been hardcoded. When the FastAPI articles endpoint is ready,
            this component will fetch and display processed news stories with bias scoring.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Articles
