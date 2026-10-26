import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'

/**
 * Sources Page Placeholder
 * 
 * Displays monitored news sources, RSS feed endpoints, and publisher credibility tags.
 */
export function Sources() {
  return (
    <div className="page-sources">
      <PageHeader
        title="News Sources"
        description="Configure and monitor news outlets, RSS feeds, and publisher perspectives."
        badge={<StatusBadge variant="info">Source Registry</StatusBadge>}
      />

      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        <Card title="Active Feeds" subtitle="RSS & API channels">
          <div className="metric-value">--</div>
          <div className="metric-label">To be fetched from FastAPI backend</div>
        </Card>

        <Card title="Publisher Diversity" subtitle="Perspective balance">
          <div className="metric-value">Pending</div>
          <div className="metric-label">National, local & international coverage</div>
        </Card>
      </div>

      <Card
        title="Registered News Sources"
        subtitle="Catalog of monitored publishers and RSS streams"
        badge={<StatusBadge variant="warning">Awaiting API</StatusBadge>}
      >
        <EmptyState
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
          }
          title="No news sources configured yet"
          description="Publisher endpoints, RSS feeds, and scraping sources will be registered and managed here once the backend database session and source services are integrated."
        />
      </Card>
    </div>
  )
}

export default Sources
