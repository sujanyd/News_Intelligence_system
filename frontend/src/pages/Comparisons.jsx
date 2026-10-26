import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

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
        <p style={{ marginBottom: '1rem' }}>
          This view will enable side-by-side evaluation of articles clustered under the same event.
          Users will be able to compare sentiment divergence, selective emphasis, and publisher bias.
        </p>

        <div className="placeholder-box">
          <div className="placeholder-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="m21 3-7 7" />
              <path d="M8 21H3v-5" />
              <path d="m3 21 7-7" />
            </svg>
          </div>
          <h4 className="placeholder-title">Comparative Analysis Placeholder</h4>
          <p className="placeholder-text">
            Actual event pairing and perspective diffs will be rendered once backend comparison endpoints
            are connected via the centralized API configuration.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Comparisons
