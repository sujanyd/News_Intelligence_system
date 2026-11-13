import React, { useEffect, useRef, useState } from 'react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import ArticleDetails from '../components/ArticleDetails'
import IngestionPanel from '../components/IngestionPanel'
import DataModeBadge from '../components/DataModeBadge'
import FlaggedArticlesPanel from '../components/FlaggedArticlesPanel'
import MatchActivityPanel from '../components/MatchActivityPanel'
import FrontPage from '../components/FrontPage'
import NewsTicker from '../components/NewsTicker'
import {
  AI_DETECTION_AVAILABLE,
  AI_FLAG_THRESHOLD,
  COMPARISONS_AVAILABLE,
  DASHBOARD_SUMMARY_AVAILABLE,
  INGESTION_AVAILABLE,
  STORIES_AVAILABLE,
  USE_MOCK_DATA,
  checkBackendHealth,
  countArticles,
  countFlaggedAiDetections,
  countEvents,
  fetchAllComparisons,
  fetchAllReports,
  fetchAllStories,
  fetchArticles,
  fetchDashboardSummary,
  fetchSources,
  runNewsCollection,
} from '../api/newsApi'
import { getSourceName } from '../utils/getSourceName'

// How many of the newest articles the dashboard shows
const RECENT_ARTICLES_COUNT = 5

// The masthead headline, word by word, so each word can be "inked" in turn.
// em: the words the editor emphasises (italic, red)
const HEADLINE_WORDS = [
  { text: 'One' },
  { text: 'story,' },
  { text: 'told', em: true },
  { text: 'differently', em: true },
  { text: 'by' },
  { text: 'every' },
  { text: 'publisher.' },
]

// "Thursday, 12 November 2026", for the date line at the top
const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// 84 -> "84"; when the count stopped early (very large database) -> "2000+"
function formatCount(result) {
  if (!result) return '--'
  return result.isComplete ? String(result.count) : `${result.count}+`
}

// { items, isComplete } -> { count, isComplete }, or null
function listCount(list) {
  return list && { count: list.items.length, isComplete: list.isComplete }
}

// The value of one settled request, or null when it failed
function settledValue(result) {
  return result.status === 'fulfilled' ? result.value : null
}

// An exact total from the summary route
function exactCount(count) {
  return { count, isComplete: true }
}

// Stories with 2 or more articles can be compared and reported on
function comparableCount(stories) {
  return (
    stories && {
      count: stories.items.filter((story) => story.article_count >= 2).length,
      isComplete: stories.isComplete,
    }
  )
}

/**
 * Loads the totals for the metric cards.
 *
 * 1. Real backend: GET /dashboard/summary gives every exact total in one
 *    request. The stories are still read to count the comparable ones
 *    (the summary has no such number).
 * 2. Mock mode, or a backend without the summary route: the lists are
 *    read page by page (see readAllPages in newsApi.js).
 *
 * @returns {Promise<{ totals: Object, errorMessage: string }>}
 */
async function loadTotals() {
  let summary = null
  if (DASHBOARD_SUMMARY_AVAILABLE) {
    try {
      summary = await fetchDashboardSummary()
    } catch {
      summary = null // count page by page below instead
    }
  }

  if (summary) {
    const [storyResult] = await Promise.allSettled([fetchAllStories()])
    return {
      errorMessage: storyResult.status === 'rejected' ? storyResult.reason.message : '',
      totals: {
        articles: exactCount(summary.total_articles),
        stories: exactCount(summary.total_stories),
        events: exactCount(summary.total_events),
        comparable: comparableCount(settledValue(storyResult)),
        comparisons: exactCount(summary.total_comparisons),
        reports: exactCount(summary.total_reports),
        flagged: exactCount(summary.total_flagged_ai_articles),
        system: {
          embeddingProvider: summary.embedding_provider,
          embeddingDimension: summary.embedding_dimension,
          qdrantMode: summary.qdrant_mode,
        },
      },
    }
  }

  const results = await Promise.allSettled([
    countArticles(),
    STORIES_AVAILABLE ? fetchAllStories() : Promise.resolve(null),
    STORIES_AVAILABLE ? countEvents() : Promise.resolve(null),
    COMPARISONS_AVAILABLE ? fetchAllComparisons() : Promise.resolve(null),
    COMPARISONS_AVAILABLE ? fetchAllReports() : Promise.resolve(null),
    AI_DETECTION_AVAILABLE ? countFlaggedAiDetections() : Promise.resolve(null),
  ])
  const [articleResult, storyResult, eventResult, comparisonResult, reportResult, flaggedResult] =
    results
  const failed = results.find((result) => result.status === 'rejected')
  const stories = settledValue(storyResult)
  return {
    errorMessage: failed ? failed.reason.message : '',
    totals: {
      articles: settledValue(articleResult),
      stories: stories && { count: stories.items.length, isComplete: stories.isComplete },
      events: settledValue(eventResult),
      comparable: comparableCount(stories),
      comparisons: listCount(settledValue(comparisonResult)),
      reports: listCount(settledValue(reportResult)),
      flagged: settledValue(flaggedResult),
      system: null,
    },
  }
}

/**
 * Dashboard Page Component
 *
 * Shows the totals (articles, sources, stories and events, comparisons,
 * reports, flagged articles), the news collection button, the newest
 * articles, the similar-article activity and the articles flagged for review.
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
  // Publisher of an article opened from the flagged list (it may not be a recent article)
  const [selectedSourceName, setSelectedSourceName] = useState(undefined)
  const detailsRef = useRef(null) // the details panel, so we can scroll to it

  // Configured news sources
  const [sources, setSources] = useState([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [sourcesError, setSourcesError] = useState('')
  const [sourcesReloadCount, setSourcesReloadCount] = useState(0)

  // Banner after a news collection that added articles: { count }
  const [stopPresses, setStopPresses] = useState(null)

  // Totals for the metric cards (see loadTotals above)
  const [totals, setTotals] = useState(null) // { articles, stories, events, comparable, comparisons, reports, flagged, system }
  const [totalsError, setTotalsError] = useState('')
  const [totalsReloadCount, setTotalsReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    loadTotals().then((result) => {
      if (!isCurrentRequest) return
      setTotalsError(result.errorMessage)
      setTotals(result.totals)
    })
    return () => {
      isCurrentRequest = false
    }
  }, [totalsReloadCount])

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

  // A collection run can add articles and new sources, so load both lists again
  function handleCollectionFinished(result) {
    // "Stop the presses!" when the run really brought in new articles
    const inserted = result?.counts?.find((count) => count.key === 'articles_inserted')?.value
    if (inserted > 0) setStopPresses({ count: inserted })
    reloadArticles()
    reloadSources()
    setTotalsReloadCount(totalsReloadCount + 1)
  }

  // "View" in the flagged list opens the article in the details panel above
  function openArticleById(articleId, sourceName) {
    setSelectedSourceName(sourceName)
    setSelectedArticleId(articleId)
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
      <FrontPage
        articles={articles}
        getSource={(article) => getSourceName(article, sources)}
        onOpen={setSelectedArticleId}
      />
    )
  }


  return (
    <div className="page-dashboard">
      {stopPresses && (
        <div className="stop-presses" role="status">
          <span className="stop-presses-kicker">Stop the presses!</span>
          <span className="stop-presses-text">
            {stopPresses.count} new {stopPresses.count === 1 ? 'article' : 'articles'} just came in
            from the feeds.
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setStopPresses(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Masthead: today's date, what the system does, and the main ways in */}
      <section className="hero" aria-labelledby="dashboard-title">
        {/* Nameplate with two "ears", like the top of a printed front page */}
        <div className="nameplate">
          <p className="ear ear-left">
            <span className="ear-label">Live edition</span>
            <span>{TODAY_LABEL}</span>
          </p>
          <p className="nameplate-title" aria-hidden="true">
            News <span className="nameplate-amp">&amp;</span> Framing
          </p>
          <p className="ear ear-right">
            <span className="ear-label">In this edition</span>
            <span>
              {totals?.stories && totals?.events
                ? `${formatCount(totals.stories)} stories · ${formatCount(totals.events)} events`
                : totals
                ? `${formatCount(totals.articles)} articles`
                : 'Counting…'}
            </span>
          </p>
        </div>

        <div className="hero-dateline">
          <span>Multi-source news bias &amp; framing analysis</span>
          <span className="hero-dateline-live">
            <span className="pulse-dot" aria-hidden="true" />
            <DataModeBadge />
          </span>
          {/* An ink roller runs along the rule while the numbers load */}
          {(!totals || isLoadingArticles) && <span className="ink-roller" aria-hidden="true" />}
        </div>

        {articles.length > 0 && (
          <NewsTicker
            items={articles.map((article) => ({
              id: article.id,
              title: article.title,
              source: getSourceName(article, sources),
            }))}
            onOpen={setSelectedArticleId}
          />
        )}

        <div className="hero-eyebrow">
          <h1 className="hero-kicker" id="dashboard-title">
            Dashboard
          </h1>
        </div>
        <p className="hero-title" aria-label="One story, told differently by every publisher.">
          {HEADLINE_WORDS.map((word, index) => {
            const style = { '--word': index }
            return (
              <React.Fragment key={word.text}>
                {word.em ? (
                  <em className="ink-word" style={style} aria-hidden="true">
                    {word.text}
                  </em>
                ) : (
                  <span className="ink-word" style={style} aria-hidden="true">
                    {word.text}
                  </span>
                )}{' '}
              </React.Fragment>
            )
          })}
        </p>
        <p className="hero-sub drop-cap">
          Collect news from several publishers, group it into stories, and compare tone, framing,
          political signals and evidence side by side.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => openPage('comparisons')}>
            Compare coverage
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => openPage('articles')}>
            Browse articles
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-lg"
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
        </div>
      </section>

      {/* Backend connection feedback alert if tested */}
      {checkResult && (
        <div className={`alert-banner ${checkResult.success ? 'success' : 'warning'}`}>
          <StatusBadge variant={checkResult.success ? 'success' : 'warning'}>
            {checkResult.success ? 'Online' : 'Notice'}
          </StatusBadge>
          <span>{checkResult.message}</span>
        </div>
      )}

      {/* Where a folded newspaper bends: everything above is "above the fold" */}
      <div className="the-fold" aria-hidden="true">
        <span>Above the fold</span>
      </div>

      {/* Metric cards: articles, sources, stories and events, comparable stories, comparisons, reports */}
      {totalsError && (
        <AlertMessage
          type="warning"
          title="Some totals could not be counted."
          message={totalsError}
          onRetry={() => setTotalsReloadCount(totalsReloadCount + 1)}
        />
      )}

      <section className="grid-metrics" aria-label="Key Performance Indicators">
        <MetricCard
          title="Total articles"
          value={formatCount(totals?.articles)}
          helperText={totals && !totals.articles ? 'Could not count' : undefined}
          isPlaceholder={USE_MOCK_DATA || !totals?.articles}
          isLoading={!totals}
          accent="blue"
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
          helperText={sourcesError ? 'Could not load sources' : undefined}
          actionLabel={onNavigate ? 'Open Sources' : undefined}
          onAction={() => openPage('sources')}
          isPlaceholder={USE_MOCK_DATA || isLoadingSources || Boolean(sourcesError)}
          isLoading={isLoadingSources}
          accent="cyan"
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
          value={`${formatCount(totals?.stories)} / ${formatCount(totals?.events)}`}
          subtitle="Stories / events"
          helperText={
            !STORIES_AVAILABLE
              ? 'Needs the real backend'
              : totals?.stories && totals?.events
              ? undefined
              : totals
              ? 'Could not count'
              : undefined
          }
          isPlaceholder={!totals?.stories || !totals?.events}
          isLoading={!totals}
          accent="violet"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />

        <MetricCard
          title="Comparable stories"
          value={formatCount(totals?.comparable)}
          subtitle="Stories with 2 or more articles"
          helperText={
            !STORIES_AVAILABLE
              ? 'Needs the real backend'
              : totals?.comparable
              ? undefined
              : totals
              ? 'Could not count'
              : undefined
          }
          isPlaceholder={!totals?.comparable}
          isLoading={!totals}
          accent="green"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="m21 3-7 7" />
              <path d="M8 21H3v-5" />
              <path d="m3 21 7-7" />
            </svg>
          }
        />

        <MetricCard
          title="Saved comparisons"
          value={formatCount(totals?.comparisons)}
          helperText={
            !COMPARISONS_AVAILABLE
              ? 'Needs the real backend'
              : totals?.comparisons
              ? undefined
              : totals
              ? 'Could not count'
              : undefined
          }
          isPlaceholder={!totals?.comparisons}
          isLoading={!totals}
          accent="amber"
          actionLabel={onNavigate ? 'Open Comparisons' : undefined}
          onAction={() => openPage('comparisons')}
        />

        <MetricCard
          title="Generated reports"
          value={formatCount(totals?.reports)}
          helperText={
            !COMPARISONS_AVAILABLE
              ? 'Needs the real backend'
              : totals?.reports
              ? undefined
              : totals
              ? 'Could not count'
              : undefined
          }
          isPlaceholder={!totals?.reports}
          isLoading={!totals}
          accent="pink"
          actionLabel={onNavigate ? 'Open Reports' : undefined}
          onAction={() => openPage('reports')}
        />

        <MetricCard
          title="Flagged for review"
          value={formatCount(totals?.flagged)}
          subtitle={`AI-likelihood estimate of ${Math.round(AI_FLAG_THRESHOLD * 100)}% or more`}
          helperText={
            !AI_DETECTION_AVAILABLE
              ? 'Needs the real backend'
              : totals?.flagged
              ? 'An estimate, not proof'
              : totals
              ? 'Could not count'
              : undefined
          }
          isPlaceholder={!totals?.flagged}
          isLoading={!totals}
          accent="amber"
        />
      </section>

      {/* How the backend says it runs: only shown when the summary route answered */}
      {totals?.system && (
        <p className="ingestion-note" data-testid="semantic-engine">
          Semantic engine: {totals.system.embeddingProvider || 'provider not given'}
          {totals.system.embeddingDimension && ` · ${totals.system.embeddingDimension}-dimensional embeddings`}
          {/* The backend only reports QDRANT_URL, so file or server storage comes back empty */}
          {` · Qdrant storage: ${totals.system.qdrantMode || 'not reported by the backend'}`}
        </p>
      )}

      {/* News collection button and the result of the last run */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <IngestionPanel
          isAvailable={INGESTION_AVAILABLE}
          unavailableReason="Turned off while the app shows mock data. Set VITE_USE_MOCK_DATA=false to collect real news."
          onRun={runNewsCollection}
          onSuccess={handleCollectionFinished}
        />
      </section>

      {/* Article details open here when "View" is clicked */}
      {selectedArticleId !== null && (
        <section className="dashboard-section dashboard-details" style={{ marginTop: '2rem' }} ref={detailsRef}>
          <ArticleDetails
            articleId={selectedArticleId}
            sourceName={selectedArticle ? getSourceName(selectedArticle, sources) : selectedSourceName}
            onClose={() => setSelectedArticleId(null)}
          />
        </section>
      )}

      {/* Newest collected articles */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <Card
          title="Front Page"
          subtitle="Newest first"
          badge={
            <button type="button" className="btn btn-secondary" onClick={() => openPage('articles')}>
              View all articles
            </button>
          }
        >
          {renderRecentArticles()}
        </Card>
      </section>

      {/* SAME / RELATED / DIFFERENT pairs of the newest articles */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <MatchActivityPanel onOpenArticle={openArticleById} />
      </section>

      {/* Articles the AI detector flagged for a person to check */}
      <section className="dashboard-section" style={{ marginTop: '2rem' }}>
        <FlaggedArticlesPanel onOpenArticle={openArticleById} />
      </section>

    </div>
  )
}

export default Dashboard
