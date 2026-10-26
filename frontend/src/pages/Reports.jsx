import React from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

/**
 * Reports Page Placeholder
 */
export function Reports() {
  return (
    <div className="page-reports">
      <PageHeader
        title="Reports"
        description="Comprehensive bias distribution statistics, framing summaries, and exportable reports."
        badge={<StatusBadge variant="info">Intelligence Reports</StatusBadge>}
      />

      <Card
        title="Analytical Bias Reports"
        subtitle="Aggregate metrics across publishers, topics, and timelines"
        badge={<StatusBadge variant="warning">Awaiting API</StatusBadge>}
      >
        <p style={{ marginBottom: '1rem' }}>
          This view will generate downloadable intelligence reports, bias distribution charts,
          and statistical summaries of framing divergence across news organizations.
        </p>

        <div className="placeholder-box">
          <div className="placeholder-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h4 className="placeholder-title">Reports Placeholder</h4>
          <p className="placeholder-text">
            Statistical aggregation and report generation will integrate with the FastAPI analytics
            pipeline once the backend endpoints are available.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Reports
