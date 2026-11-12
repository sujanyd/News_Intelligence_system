import React, { useContext, useEffect, useState } from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import ContentAvailabilityBadge from './ContentAvailabilityBadge'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import SimilarArticlesSection from './SimilarArticlesSection'
import ArticleInsightsSection from './ArticleInsightsSection'
import PoliticalAnalysisSection from './PoliticalAnalysisSection'
import ToneFramingSection from './ToneFramingSection'
import AiDetectionSection from './AiDetectionSection'
import DuplicateCheckSection from './DuplicateCheckSection'
import { NavigationContext } from '../navigation'
import { fetchArticle, STORIES_AVAILABLE } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

/**
 * ArticleDetails Component
 *
 * Loads one article from GET /api/articles/{id} and displays its full
 * information in clearly separated sections:
 *
 *   1. Article Information   – title, source, dates, URL, link to its event
 *   2. Article Content       – full text, summary, or headline-only notice
 *   3. Article Insights      – extracted topics, entities, facts and quotes
 *   4. Political Analysis    – political entities and how they are worded
 *   5. Tone and Framing      – tone, headline framing, framing signals
 *   6. Similar Articles      – semantically similar articles via vector search
 *   7. AI Detection          – estimated likelihood of machine-generated text
 *
 * States handled: loading, API error, article-not-found (HTTP 404),
 * missing content (null / empty string), summary-only, headline-only.
 *
 * Navigation: Supports traversing into similar articles with a history stack
 * allowing users to return to previously inspected articles.
 *
 * @param {Object}             props
 * @param {number | string}    props.articleId        - Which article to load
 * @param {string}             [props.sourceName]     - Source name shown while loading
 * @param {() => void}         props.onClose          - Called when the user closes the panel
 * @param {(id: number) => void} [props.onSelectArticle] - Called when user navigates to an article
 */
export function ArticleDetails({ articleId, sourceName, onClose, onSelectArticle }) {
  // Opens other pages (null when rendered on its own, e.g. in a test)
  const navigate = useContext(NavigationContext)

  // Navigation stack state
  const [activeArticleId, setActiveArticleId] = useState(articleId)
  const [history, setHistory] = useState([])

  const [article, setArticle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)


  // Reset if external articleId prop changes
  const [prevPropArticleId, setPrevPropArticleId] = useState(articleId)
  if (articleId !== prevPropArticleId) {
    setPrevPropArticleId(articleId)
    setActiveArticleId(articleId)
    setHistory([])
  }

  // Reset loading & states whenever activeArticleId changes
  const [prevActiveId, setPrevActiveId] = useState(activeArticleId)
  if (activeArticleId !== prevActiveId) {
    setPrevActiveId(activeArticleId)
    setIsLoading(true)
    setErrorMessage('')
    setIsNotFound(false)
    setArticle(null)
  }

  useEffect(() => {
    let isCurrentRequest = true

    fetchArticle(activeArticleId)
      .then((result) => {
        if (isCurrentRequest) setArticle(result)
      })
      .catch((error) => {
        if (!isCurrentRequest) return
        if (error.status === 404 || /404|not found/i.test(error.message)) {
          setIsNotFound(true)
        } else {
          setErrorMessage(error.message)
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false)
      })

    return () => {
      isCurrentRequest = false
    }
  }, [activeArticleId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setIsNotFound(false)
    setReloadCount((c) => c + 1)
  }

  // ── Navigation between similar articles ───────────────────────────────────
  function handleSelectSimilar(similarId) {
    if (similarId === activeArticleId) return
    setHistory((prev) => [
      ...prev,
      {
        id: activeArticleId,
        title: article ? article.title : `Article #${activeArticleId}`,
      },
    ])
    setActiveArticleId(similarId)
    if (onSelectArticle) {
      onSelectArticle(similarId)
    }
  }

  function handleReturnToPrevious() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setActiveArticleId(prev.id)
    if (onSelectArticle) {
      onSelectArticle(prev.id)
    }
  }

  // ── Close / Navigation buttons in card header ─────────────────────────────
  const closeButton = (
    <div className="ad-header-actions">
      {history.length > 0 && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleReturnToPrevious}
          aria-label="Return to previous article"
        >
          ← Return to previous article
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        aria-label="Back to articles"
      >
        ← Back to articles
      </button>
    </div>
  )

  // ── Content availability helpers ─────────────────────────────────────────
  function renderContentBody() {
    const avail = article.content_availability

    if (avail === 'headline_only') {
      return (
        <div className="ad-content-notice" data-testid="content-notice-headline">
          <StatusBadge variant="warning">Headline only</StatusBadge>
          <p className="ad-notice-text">
            Only the headline was collected for this article. The full text is not available in
            this system.
          </p>
        </div>
      )
    }

    const hasContent = article.content && article.content.trim() !== ''

    if (!hasContent) {
      return (
        <div className="ad-content-notice" data-testid="content-notice-missing">
          <StatusBadge variant="warning">Content not available</StatusBadge>
          <p className="ad-notice-text">
            {avail === 'summary_only'
              ? 'A summary was expected but the text was not retrieved. The full article may be behind a paywall.'
              : 'No text was retrieved for this article.'}
          </p>
        </div>
      )
    }

    return (
      <div className="ad-content-body" data-testid="content-body">
        {avail === 'summary_only' && (
          <div className="ad-summary-notice">
            <span className="ad-summary-note">
              This is a summary, not the full article text.
            </span>
          </div>
        )}
        <p className="details-content">{article.content}</p>
      </div>
    )
  }

  // ── Main body ─────────────────────────────────────────────────────────────
  function renderBody() {
    if (isLoading) {
      return <LoadingState message="Loading article..." />
    }

    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load this article."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }

    if (isNotFound) {
      return (
        <AlertMessage
          type="warning"
          title="Article not found."
          message={`Article #${activeArticleId} no longer exists in the system. It may have been removed.`}
        />
      )
    }

    if (!article) return null

    return (
      <>
        {/* Navigation Breadcrumb Trail if navigating history */}
        {history.length > 0 && (
          <div className="ad-history-banner" data-testid="history-banner">
            <span className="ad-history-label">Viewing similar article:</span>
            <button
              type="button"
              className="ad-history-link"
              onClick={handleReturnToPrevious}
              title={`Return to: ${history[history.length - 1].title}`}
            >
              ← Back to {history[history.length - 1].title}
            </button>
          </div>
        )}

        {/* ── Section 1: Article Information ───────────────────────────── */}
        <section className="ad-section" aria-labelledby="ad-section-info">
          <h4 className="ad-section-title" id="ad-section-info">
            Article Information
          </h4>

          <dl className="details-list">
            <div>
              <dt>Published</dt>
              <dd>{formatDate(article.published_at)}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{formatDate(article.retrieved_at)}</dd>
            </div>
          </dl>

          <div className="ad-url-row">
            <span className="ad-url-label">Original article</span>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="table-link ad-url-link"
              >
                {article.url}
              </a>
            ) : (
              <span className="ad-url-missing">URL not available</span>
            )}
          </div>

          {navigate && STORIES_AVAILABLE && (
            <div className="ad-nav-row">
              {article.event_id ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('stories', { name: 'event', eventId: article.event_id })}
                >
                  Open its event and story
                </button>
              ) : (
                <span className="ad-url-missing">
                  Not in a story yet: use &quot;Group articles&quot; on the Stories page.
                </span>
              )}
            </div>
          )}
        </section>

        {/* ── Section 2: Article Content ────────────────────────────────── */}
        <section className="ad-section" aria-labelledby="ad-section-content">
          <h4 className="ad-section-title" id="ad-section-content">
            Article Content{' '}
            <ContentAvailabilityBadge availability={article.content_availability} />
          </h4>
          {renderContentBody()}
        </section>

        {/* ── Section 3: Article Insights ──────────────────────────────── */}
        <ArticleInsightsSection
          key={activeArticleId}
          articleId={activeArticleId}
          contentAvailability={article.content_availability}
        />

        {/* ── Section 4: Political Analysis ────────────────────────────── */}
        <PoliticalAnalysisSection key={`political-${activeArticleId}`} articleId={activeArticleId} />

        {/* ── Section 5: Tone and Framing ──────────────────────────────── */}
        <ToneFramingSection
          key={`tone-${activeArticleId}`}
          articleId={activeArticleId}
          contentAvailability={article.content_availability}
        />

        {/* ── Section 6: Similar Articles ────────────────────────────────── */}
        <SimilarArticlesSection
          articleId={activeArticleId}
          onSelectArticle={handleSelectSimilar}
        />

        {/* ── Section 7: AI Detection ──────────────────────────────────── */}
        <AiDetectionSection
          key={`ai-${activeArticleId}`}
          articleId={activeArticleId}
          contentAvailability={article.content_availability}
        />

        {/* ── Section 8: Duplicate Check ───────────────────────────────── */}
        <DuplicateCheckSection
          key={`dup-${activeArticleId}`}
          articleId={activeArticleId}
          duplicateOfArticleId={article.duplicate_of_article_id}
          onOpenArticle={handleSelectSimilar}
        />
      </>
    )
  }

  const cardTitle = article ? article.title : isNotFound ? 'Article not found' : 'Article details'
  const cardSubtitle = article
    ? article.source_name || sourceName || undefined
    : isLoading
    ? 'Loading…'
    : undefined

  return (
    <section aria-label="Article details" className="article-details">
      <Card title={cardTitle} subtitle={cardSubtitle} badge={closeButton}>
        {renderBody()}
      </Card>
    </section>
  )
}

export default ArticleDetails
