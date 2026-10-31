import React, { useEffect, useState } from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import ContentAvailabilityBadge from './ContentAvailabilityBadge'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import { fetchArticle } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

/**
 * ArticleDetails Component
 *
 * Loads one article from GET /api/articles/{id} and displays its full
 * information in clearly separated sections:
 *
 *   1. Article Information  – title, source, dates, URL
 *   2. Article Content      – full text, summary, or headline-only notice
 *   3. Source Information   – source name from the backend
 *   4. Analysis             – placeholder for future AI features
 *
 * States handled: loading, API error, article-not-found (HTTP 404),
 * missing content (null / empty string), summary-only, headline-only.
 *
 * @param {Object}             props
 * @param {number | string}    props.articleId  - Which article to load
 * @param {string}             props.sourceName - Source name shown while loading
 * @param {() => void}         props.onClose    - Called when the user closes the panel
 */
export function ArticleDetails({ articleId, sourceName, onClose }) {
  const [article, setArticle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  const [prevArticleId, setPrevArticleId] = useState(articleId)
  if (articleId !== prevArticleId) {
    setPrevArticleId(articleId)
    setIsLoading(true)
    setErrorMessage('')
    setIsNotFound(false)
    setArticle(null)
  }

  useEffect(() => {
    let isCurrentRequest = true

    fetchArticle(articleId)
      .then((result) => {
        if (isCurrentRequest) setArticle(result)
      })
      .catch((error) => {
        if (!isCurrentRequest) return
        // HTTP 404 gets its own state so the UI can explain it clearly
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
  }, [articleId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setIsNotFound(false)
    setReloadCount((c) => c + 1)
  }

  // ── Close button (always in the card header) ─────────────────────────────
  const closeButton = (
    <button type="button" className="btn btn-secondary" onClick={onClose}>
      ← Back to articles
    </button>
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
            <StatusBadge variant="info">Summary only</StatusBadge>
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
          message={`Article #${articleId} no longer exists in the system. It may have been removed.`}
        />
      )
    }

    if (!article) return null

    const effectiveSourceName =
      article.source_name || sourceName || (article.source_id ? `Source #${article.source_id}` : 'Unknown source')

    return (
      <>
        {/* ── Section 1: Article Information ───────────────────────────── */}
        <section className="ad-section" aria-labelledby="ad-section-info">
          <h4 className="ad-section-title" id="ad-section-info">
            Article Information
          </h4>

          <dl className="details-list">
            <div>
              <dt>Source</dt>
              <dd>{effectiveSourceName}</dd>
            </div>
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
        </section>

        {/* ── Section 2: Article Content ────────────────────────────────── */}
        <section className="ad-section" aria-labelledby="ad-section-content">
          <h4 className="ad-section-title" id="ad-section-content">
            Article Content{' '}
            <ContentAvailabilityBadge availability={article.content_availability} />
          </h4>
          {renderContentBody()}
        </section>

        {/* ── Section 3: Source Information ─────────────────────────────── */}
        <section className="ad-section" aria-labelledby="ad-section-source">
          <h4 className="ad-section-title" id="ad-section-source">
            Source Information
          </h4>
          <dl className="details-list ad-source-list">
            <div>
              <dt>News source</dt>
              <dd>{effectiveSourceName}</dd>
            </div>
            {article.source_id && (
              <div>
                <dt>Source ID</dt>
                <dd>#{article.source_id}</dd>
              </div>
            )}
          </dl>
          <p className="ad-section-note">
            Bias profile, credibility rating and full source history will appear here in a future
            release.
          </p>
        </section>

        {/* ── Section 4: Analysis (future features) ────────────────────── */}
        <section
          className="ad-section ad-analysis-section"
          aria-labelledby="ad-section-analysis"
          data-testid="analysis-section"
        >
          <h4 className="ad-section-title" id="ad-section-analysis">
            Analysis
            <StatusBadge variant="primary" className="ad-coming-soon">
              Coming soon
            </StatusBadge>
          </h4>

          <p className="ad-analysis-placeholder-msg">
            Analysis has not been generated for this article yet.
          </p>

          <div className="ad-analysis-grid">
            {[
              {
                id: 'ai-detection',
                icon: '🤖',
                title: 'AI-Generated Content Detection',
                desc: 'Probability score and indicators that the article was written by an AI system.',
              },
              {
                id: 'tone',
                icon: '🎭',
                title: 'Tone Analysis',
                desc: 'Sentiment classification (positive / neutral / negative) across article sections.',
              },
              {
                id: 'framing',
                icon: '🖼️',
                title: 'Framing Analysis',
                desc: 'How the story is framed — economic, human-interest, conflict or morality.',
              },
              {
                id: 'topics',
                icon: '🏷️',
                title: 'Topics & Key Facts',
                desc: 'Automatically extracted topics, named entities and verifiable claims.',
              },
              {
                id: 'comparison',
                icon: '↔️',
                title: 'Similar Article Comparison',
                desc: 'How other sources covered the same event and where their framing differs.',
              },
            ].map((feature) => (
              <div key={feature.id} className="ad-analysis-card" data-testid={`analysis-card-${feature.id}`}>
                <span className="ad-analysis-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <div>
                  <p className="ad-analysis-card-title">{feature.title}</p>
                  <p className="ad-analysis-card-desc">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
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
