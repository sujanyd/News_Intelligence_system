import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'

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
        <EmptyState
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
          }
          title="No articles collected yet"
          description="The articles repository is empty. Once the FastAPI news collection pipeline ingests and parses RSS feeds, real articles will populate this table with bias and framing scores."
        />
      </Card>
    </div>
  )
}

export default Articles
