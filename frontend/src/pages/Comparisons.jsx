import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'

/**
 * Comparisons Page Placeholder
 */
export function Comparisons() {
  return (
    <div className="page-comparisons">
      <PageHeader
        title="Comparisons"
        description="Side-by-side news framing analysis comparing how diverse outlets cover identical events."
        badge={<StatusBadge variant="primary">Comparative Analysis</StatusBadge>}
      />

      <Card
        title="Cross-Publisher Framing Comparison"
        subtitle="Divergence in headline phrasing, tone, and focal points"
        badge={<StatusBadge variant="warning">Awaiting API</StatusBadge>}
      >
        <EmptyState
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="m21 3-7 7" />
              <path d="M8 21H3v-5" />
              <path d="m3 21 7-7" />
            </svg>
          }
          title="No comparisons completed yet"
          description="Side-by-side event comparisons will be generated once multiple articles covering the same breaking story are clustered and evaluated by the NLP analysis service."
        />
      </Card>
    </div>
  )
}

export default Comparisons
