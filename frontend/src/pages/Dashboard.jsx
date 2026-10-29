import React, { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import ContentAvailabilityBadge from '../components/ContentAvailabilityBadge'
import ArticleDetails from '../components/ArticleDetails'
import IngestionPanel from '../components/IngestionPanel'
import DataModeBadge from '../components/DataModeBadge'
import {
  INGESTION_AVAILABLE,
  USE_MOCK_DATA,
  checkBackendHealth,
  fetchArticles,
  fetchSources,
  runNewsCollection,
} from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { getSourceName } from '../utils/getSourceName'

// How many of the newest articles the dashboard shows
const RECENT_ARTICLES_COUNT = 5

/**
 * Dashboard Page Component
 *
 * Shows the newest collected articles (GET /articles), the configured news
 * sources (GET /sources), the news collection button, and the pipeline overview.
 *
 * @param {Object} props
 * @param {(tab: string) => void} [props.onNavigate] - opens another page, e.g. 'articles'
 */
export function Dashboard({ onNavigate }) {
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  // Newest articles (the backend sends the newest first)
  const [articles, setArticles] = useState([])
  const [isLoadingArticles, setIsLoadingArticles] = useState(true)
  const [articlesError, setArticlesError] = useState('')
  const [articlesReloadCount, setArticlesReloadCount] = useState(0)
  const [selectedArticleId, setSelectedArticleId] = useState(null)
  const detailsRef = useRef(null) // the details panel, so we can scroll to it

  // Configured news sources
  const [sources, setSources] = useState([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [sourcesError, setSourcesError] = useState('')
  const [sourcesReloadCount, setSourcesReloadCount] = useState(0)

  // Load the newest articles (again whenever articlesReloadCount goes up)
  useEffect(() => {
    let isCurrentRequest = true
    fetchArticles({ limit: RECENT_ARTICLES_COUNT, offset: 0 })
      .then((result) => {
        if (isCurrentRequest) setArticles(result.articles)
      })
      .catch((error) => {
        if (isCurrentRequest) setArticlesError(error.message)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingArticles(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [articlesReloadCount])

  // Load the sources (again whenever sourcesReloadCount goes up)
  useEffect(() => {
    let isCurrentRequest = true
    fetchSources()
      .then((sourceList) => {
        if (isCurrentRequest) setSources(sourceList)
      })
      .catch((error) => {
        if (isCurrentRequest) setSourcesError(error.message)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingSources(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [sourcesReloadCount])

  // When an article is opened, scroll its details panel into view
  useEffect(() => {
    if (selectedArticleId !== null && detailsRef.current && detailsRef.current.scrollIntoView) {
      detailsRef.current.scrollIntoView({ block: 'start' })
    }
  }, [selectedArticleId])

  function reloadArticles() {
    setIsLoadingArticles(true)
    setArticlesError('')
    setArticlesReloadCount(articlesReloadCount + 1)
  }

  function reloadSources() {
    setIsLoadingSources(true)
    setSourcesError('')
    setSourcesReloadCount(sourcesReloadCount + 1)
  }

  function openPage(tab) {
    if (onNavigate) onNavigate(tab)
  }

  const handleCheckConnection = async () => {
    setIsCheckingBackend(true)
    setCheckResult(null)
    try {
      // Uses the existing GET /health route through the shared API client
      await checkBackendHealth()
      setCheckResult({ success: true, message: 'FastAPI Backend is reachable and healthy!' })
    } catch (error) {
      setCheckResult({ success: false, message: error.message })
    } finally {
      setIsCheckingBackend(false)
    }
  }

  const selectedArticle = articles.find((article) => article.id === selectedArticleId)

  const articleColumns = [
    { key: 'title', label: 'Title', render: (article) => <strong>{article.title}</strong> },
    { key: 'source', label: 'Source', render: (article) => getSourceName(article, sources) },
    { key: 'published_at', label: 'Published', render: (article) => formatDate(article.published_at) },
    {
      key: 'content_availability',
      label: 'Content',
      render: (article) => <ContentAvailabilityBadge availability={article.content_availability} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (article) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSelectedArticleId(article.id)}
          aria-label={`View details for ${article.title}`}
        >
          View
        </button>
      ),
    },
  ]

  const sourceColumns = [
    { key: 'name', label: 'Name', render: (source) => <strong>{source.name}</strong> },
    {
      key: 'base_url',
      label: 'Base URL',
      render: (source) =>
        source.base_url ? (
          <a href={source.base_url} target="_blank" rel="noreferrer" className="table-link">
            {source.base_url}
          </a>
        ) : (
          'Not available'
        ),
    },
    { key: 'created_at', label: 'Added', render: (source) => formatDate(source.created_at) },
  ]

  function renderRecentArticles() {
    if (isLoadingArticles) {
      return <LoadingState message="Loading recent articles..." />
    }
    if (articlesError) {
      return (
        <AlertMessage
          type="error"
          title="Could not load recent articles."
          message={articlesError}
          onRetry={reloadArticles}
        />
      )
    }
    if (articles.length === 0) {
      return (
        <EmptyState
          title="No articles collected yet"
          description="The backend has no articles stored. They will appear here after news is collected or added."
        />
      )
    }
    return (
      <DataTable columns={articleColumns} rows={articles} caption="Most recent articles" />
    )
  }

  function renderSources() {
    if (isLoadingSources) {
      return <LoadingState message="Loading sources..." />
    }
    if (sourcesError) {
      return (
        <AlertMessage
          type="error"
          title="Could not load sources."
          message={sourcesError}
          onRetry={reloadSources}
        />
      )
    }
    if (sources.length === 0) {
      return (
        <EmptyState
          title="No news sources configured yet"
          description="Add a source on the Sources page."
        />
      )
    }
    return (
      <>
        <DataTable columns={sourceColumns} rows={sources} caption="Configured news sources" />
        <p className="ingestion-note">
          The backend does not report whether each source&apos;s feed is working, so no
          connection status is shown.
        </p>
      </>
    )
  }

  return (
    <div className="page-dashboard">
      <PageHeader
        title="Dashboard"
        description="Monitor collected news coverage, semantic event clusters, and perspective framing analyses."
        badge={<DataModeBadge />}
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
          helperText="No total from backend yet"
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
          value={isLoadingSources || sourcesError ? '--' : String(sources.length)}
          subtitle="Monitored publishers"
          helperText={sourcesError ? 'Could not load sources' : 'From the backend'}
          isPlaceholder={USE_MOCK_DATA || isLoadingSources || Boolean(sourcesError)}
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

      {/* News collection button and the result of the last run */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <IngestionPanel
          isAvailable={INGESTION_AVAILABLE}
          onRun={runNewsCollection}
          onSuccess={reloadArticles}
        />
      </section>

      {/* Article details open here when "View" is clicked */}
      {selectedArticle && (
        <section className="dashboard-section dashboard-details" style={{ marginTop: '2rem' }} ref={detailsRef}>
          <ArticleDetails
            key={selectedArticle.id}
            articleId={selectedArticle.id}
            sourceName={getSourceName(selectedArticle, sources)}
            onClose={() => setSelectedArticleId(null)}
          />
        </section>
      )}

      {/* Newest collected articles */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <Card
          title="Recent Articles"
          subtitle="The newest articles stored in the backend"
          badge={
            <button type="button" className="btn btn-secondary" onClick={() => openPage('articles')}>
              View all articles
            </button>
          }
        >
          {renderRecentArticles()}
        </Card>
      </section>

      {/* Configured news sources */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <Card
          title="News Sources"
          subtitle="Publishers configured in the backend"
          badge={
            <button type="button" className="btn btn-secondary" onClick={() => openPage('sources')}>
              Manage sources
            </button>
          }
        >
          {renderSources()}
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
