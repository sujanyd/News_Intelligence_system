import React, { useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import { API_BASE_URL } from '../api/config'

/**
 * Dashboard Page Component
 * 
 * Main monitoring interface displaying key metric placeholders,
 * system pipeline readiness, and an empty state for recent articles.
 */
export function Dashboard() {
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  const handleCheckConnection = async () => {
    setIsCheckingBackend(true)
    setCheckResult(null)
    try {
      // Attempt connection to the FastAPI health endpoint without inventing new routes
      const response = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (response.ok) {
        setCheckResult({ success: true, message: 'FastAPI Backend is reachable and healthy!' })
      } else {
        setCheckResult({ success: false, message: `Backend responded with HTTP ${response.status}.` })
      }
    } catch {
      setCheckResult({
        success: false,
        message: `Could not reach ${API_BASE_URL}. Ensure FastAPI is running on port 8000.`,
      })
    } finally {
      setIsCheckingBackend(false)
    }
  }

  return (
    <div className="page-dashboard">
      <PageHeader
        title="Dashboard"
        description="Monitor collected news coverage, semantic event clusters, and perspective framing analyses."
        badge={<StatusBadge variant="success">Frontend Ready</StatusBadge>}
        action={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCheckConnection}
            disabled={isCheckingBackend}
          >
            {isCheckingBackend ? (
              <span className="loading-spinner-wrap">
                <span className="spinner" /> Checking Backend...
              </span>
            ) : (
              'Check Backend Status'
            )}
          </button>
        }
      />

      {/* Backend connection feedback alert if tested */}
      {checkResult && (
        <div className={`alert-banner ${checkResult.success ? 'success' : 'warning'}`}>
          <StatusBadge variant={checkResult.success ? 'success' : 'warning'}>
            {checkResult.success ? 'Online' : 'Notice'}
          </StatusBadge>
          <span>{checkResult.message}</span>
        </div>
      )}

      {/* 4 Metric Cards (Total articles, News sources, Stories and events, Comparisons completed) */}
      <section className="grid-metrics" aria-label="Key Performance Indicators">
        <MetricCard
          title="Total articles"
          value="--"
          subtitle="Collected news stories"
          helperText="Awaiting ingestion pipeline"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
          }
        />

        <MetricCard
          title="News sources"
          value="--"
          subtitle="Monitored publishers"
          helperText="RSS feeds & API sources"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
          }
        />

        <MetricCard
          title="Stories and events"
          value="--"
          subtitle="Semantic clusters"
          helperText="Vector similarity groupings"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />

        <MetricCard
          title="Comparisons completed"
          value="--"
          subtitle="Cross-outlet evaluations"
          helperText="Bias & framing divergence"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="m21 3-7 7" />
              <path d="M8 21H3v-5" />
              <path d="m3 21 7-7" />
            </svg>
          }
        />
      </section>

      {/* Recent Articles Section with Empty State */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <Card
          title="Recent Articles"
          subtitle="Real-time news stories ingested across registered publishers"
          badge={<StatusBadge variant="info">Stream Status</StatusBadge>}
        >
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
            title="No articles collected yet"
            description="Articles will appear here after backend integration. Once the FastAPI news collection pipeline and PostgreSQL database models are active, newly ingested articles with sentiment and framing scores will be displayed in this feed."
          />
        </Card>
      </section>

      {/* Analysis Pipeline & Architecture Preparation */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <Card
          title="System Pipeline & Analysis Architecture"
          subtitle="Overview of automated news intelligence stages"
          badge={<StatusBadge variant="primary">Architecture</StatusBadge>}
        >
          <div className="pipeline-steps">
            <div className="pipeline-step-item">
              <div className="step-number">1</div>
              <div className="step-details">
                <h4 className="step-title">Ingestion & Preprocessing</h4>
                <p className="step-desc">
                  Automated harvesting from RSS feeds and news APIs, text cleaning, and author/date normalization.
                </p>
                <StatusBadge variant="warning">Awaiting Ingestion Service</StatusBadge>
              </div>
            </div>

            <div className="pipeline-step-item">
              <div className="step-number">2</div>
              <div className="step-details">
                <h4 className="step-title">Semantic Clustering & Deduplication</h4>
                <p className="step-desc">
                  Vector embeddings cluster parallel coverage of identical breaking events into unified story groups.
                </p>
                <StatusBadge variant="info">Embeddings Layer</StatusBadge>
              </div>
            </div>

            <div className="pipeline-step-item">
              <div className="step-number">3</div>
              <div className="step-details">
                <h4 className="step-title">Bias & Framing Classification</h4>
                <p className="step-desc">
                  NLP algorithms and LLM evaluations score political leanings, narrative focal points, and tone divergence.
                </p>
                <StatusBadge variant="primary">Analysis Layer</StatusBadge>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

export default Dashboard
