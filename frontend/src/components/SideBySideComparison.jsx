import React, { useState, useEffect } from 'react'
import ClassificationBadge from './ClassificationBadge'
import ContentAvailabilityBadge from './ContentAvailabilityBadge'
import AlertMessage from './AlertMessage'
import { formatDate } from '../utils/formatDate'
import { formatSimilarityPercentage } from '../utils/formatSimilarity'
import { fetchArticle, MATCH_REVIEW_AVAILABLE } from '../api/newsApi'

/**
 * SideBySideComparison Component
 *
 * Implements side-by-side comparison between two articles in a matched pair:
 *
 * Article A:
 *   - Headline
 *   - Source
 *   - Publication date
 *   - Available summary or content
 *
 * Article B:
 *   - Headline
 *   - Source
 *   - Publication date
 *   - Available summary or content
 *
 * Separate metrics display:
 *   - Similarity score: measures semantic vector closeness (0% to 100%)
 *   - Classification confidence: indicates system confidence in the assigned label
 *   - Explicit disclaimer that neither metric proves factual correctness
 *   - Matching method / model name
 *   - Review status
 *
 * Review Functionality:
 *   - If review endpoints are not supported by the backend:
 *     operates in clean read-only mode with a clear explanatory notice.
 *   - If review updates are supported:
 *     provides classification correction, mark as reviewed, and notes submission.
 *
 * @param {Object} props
 * @param {Object} props.match - Normalized ArticleMatch object
 * @param {() => void} props.onClose - Callback to close comparison view
 * @param {boolean} [props.isReviewSupported=MATCH_REVIEW_AVAILABLE] - Whether backend supports review API
 * @param {(matchId: number|string, reviewData: Object) => Promise<any>} [props.onReviewSubmit] - Review handler
 */
export function SideBySideComparison({
  match,
  onClose,
  isReviewSupported = MATCH_REVIEW_AVAILABLE,
  onReviewSubmit,
}) {
  const safeMatch = match || {}
  const {
    id,
    article_a: initialArtA = {},
    article_b: initialArtB = {},
    match_label: initialLabel,
    similarity_score,
    confidence_score,
    model_name,
    review_status: initialReviewStatus,
    reviewer_notes: initialNotes,
  } = safeMatch

  // Article contents (fetch full content if not already populated)
  const [artA, setArtA] = useState(initialArtA)
  const [artB, setArtB] = useState(initialArtB)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentError, setContentError] = useState(null)

  // Review state
  const [currentLabel, setCurrentLabel] = useState(initialLabel || 'RELATED')
  const [isReviewed, setIsReviewed] = useState(
    String(initialReviewStatus).toLowerCase() === 'reviewed'
  )
  const [reviewerNotes, setReviewerNotes] = useState(initialNotes || '')
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState(null)
  const [reviewErrorMsg, setReviewErrorMsg] = useState(null)

  // Fetch full article content for both articles if missing full text
  useEffect(() => {
    let isCancelled = false

    async function loadFullArticleContent() {
      const needsA = !artA.content && artA.id
      const needsB = !artB.content && artB.id

      if (!needsA && !needsB) return

      setIsLoadingContent(true)
      setContentError(null)

      try {
        const promises = []
        if (needsA) promises.push(fetchArticle(artA.id))
        if (needsB) promises.push(fetchArticle(artB.id))

        const results = await Promise.allSettled(promises)

        if (isCancelled) return

        let resultIdx = 0
        if (needsA) {
          const resA = results[resultIdx++]
          if (resA.status === 'fulfilled' && resA.value) {
            setArtA((prev) => ({
              ...prev,
              content: resA.value.content,
              content_availability: resA.value.content_availability || prev.content_availability,
            }))
          }
        }

        if (needsB) {
          const resB = results[resultIdx++]
          if (resB.status === 'fulfilled' && resB.value) {
            setArtB((prev) => ({
              ...prev,
              content: resB.value.content,
              content_availability: resB.value.content_availability || prev.content_availability,
            }))
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setContentError(err.message || 'Could not fetch full article details.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingContent(false)
        }
      }
    }

    loadFullArticleContent()

    return () => {
      isCancelled = true
    }
  }, [artA.id, artA.content, artB.id, artB.content])

  const similarityFormatted = formatSimilarityPercentage(similarity_score)
  const confidenceFormatted =
    typeof confidence_score === 'number' && !Number.isNaN(confidence_score)
      ? `${Math.round(confidence_score * 100)}%`
      : null

  // Handle Review Submission (when supported)
  async function handleSaveReview(e) {
    e.preventDefault()
    if (!isReviewSupported) return

    setIsSavingReview(true)
    setReviewSuccessMsg(null)
    setReviewErrorMsg(null)

    try {
      if (onReviewSubmit) {
        await onReviewSubmit(id, {
          reviewed: isReviewed,
          match_label: currentLabel,
          reviewer_notes: reviewerNotes,
        })
      }
      setReviewSuccessMsg('Review classification saved successfully.')
    } catch (err) {
      setReviewErrorMsg(err.message || 'Failed to save review changes.')
    } finally {
      setIsSavingReview(false)
    }
  }

  if (!match) return null

  return (
    <div className="side-by-side-comparison" data-testid="side-by-side-comparison">
      {/* Top Header & Navigation */}
      <div className="sbs-header">
        <div className="sbs-header-left">
          <button
            type="button"
            className="btn btn-secondary btn-sm sbs-back-btn"
            onClick={onClose}
            aria-label="Back to matched pairs list"
          >
            ← Back to Matched Pairs
          </button>
          <div className="sbs-title-block">
            <h3 className="sbs-heading">Side-by-Side Article Comparison</h3>
            <span className="sbs-subtitle">
              Inspect semantic alignment and verify whether outlets cover identical or divergent stories.
            </span>
          </div>
        </div>

        <div className="sbs-header-right">
          <ClassificationBadge label={currentLabel} size="lg" />
        </div>
      </div>

      {contentError && (
        <AlertMessage variant="warning" className="sbs-alert">
          {contentError}
        </AlertMessage>
      )}

      {/* Explanatory Confidence and Matching Information Panel */}
      <section className="matching-info-banner" aria-label="Matching Metrics & Confidence Information">
        <div className="mib-header">
          <h4 className="mib-title">Matching & Classification Assessment</h4>
          <span className="mib-tag">Pair ID: #{id}</span>
        </div>

        <div className="mib-grid">
          {/* Similarity Metric Card */}
          <div className="mib-card" data-testid="sbs-similarity-card">
            <div className="mib-card-top">
              <span className="mib-metric-label">Semantic Similarity Score</span>
              <strong className="mib-metric-number">
                {similarityFormatted || 'Not available'}
              </strong>
            </div>
            <p className="mib-card-desc">
              Measures mathematical vector distance between headline/text embeddings in high-dimensional space.
              A high score reflects lexical and topical closeness, but does not prove both articles report on the exact same event.
            </p>
          </div>

          {/* Classification Confidence Card */}
          <div className="mib-card" data-testid="sbs-confidence-card">
            <div className="mib-card-top">
              <span className="mib-metric-label">Classification Confidence</span>
              <strong className="mib-metric-number">
                {confidenceFormatted || 'Not available'}
              </strong>
            </div>
            <p className="mib-card-desc">
              Indicates the pairwise classifier's statistical certainty in the assigned classification label.
              This reflects model confidence, not guaranteed factual accuracy.
            </p>
          </div>

          {/* Matching Method & Audit Info */}
          <div className="mib-card" data-testid="sbs-method-card">
            <div className="mib-card-top">
              <span className="mib-metric-label">Matching Pipeline</span>
              <span className="mib-method-badge">{model_name || 'Standard embedding pipeline'}</span>
            </div>
            <div className="mib-audit-row">
              <span className="mib-audit-label">Human Review Status:</span>
              <span
                className={`mib-review-tag ${isReviewed ? 'mib-reviewed' : 'mib-unreviewed'}`}
                data-testid="sbs-review-status-tag"
              >
                {isReviewed ? '✓ Reviewed' : '○ Pending Review'}
              </span>
            </div>
            <p className="mib-card-desc">
              Neither similarity nor model confidence should be treated as absolute proof. Editorial review is recommended for ambiguous pairs.
            </p>
          </div>
        </div>
      </section>

      {/* Side-by-Side Comparison Columns */}
      <div className="sbs-columns-grid">
        {/* Column A: Article A */}
        <section
          className="sbs-column sbs-column-a"
          data-testid="sbs-column-article-a"
          aria-label="Article A Details"
        >
          <div className="sbs-column-top">
            <span className="sbs-role-badge">Article A (Original / Seed)</span>
            {artA.content_availability && (
              <ContentAvailabilityBadge availability={artA.content_availability} />
            )}
          </div>

          <h4 className="sbs-headline">{artA.title || 'Untitled article'}</h4>

          <div className="sbs-meta-bar">
            {artA.source_name && (
              <span className="sbs-meta-item">
                <span className="sbs-meta-icon" aria-hidden="true">📰</span>
                <strong>{artA.source_name}</strong>
              </span>
            )}
            <span className="sbs-meta-item">
              <span className="sbs-meta-icon" aria-hidden="true">📅</span>
              {formatDate(artA.published_at)}
            </span>
            {artA.url && (
              <a
                href={artA.url}
                target="_blank"
                rel="noreferrer"
                className="sbs-external-link"
                title="Open original article in new tab"
              >
                Original link ↗
              </a>
            )}
          </div>

          <div className="sbs-content-section">
            <div className="sbs-content-label">Article Text / Available Content:</div>
            {isLoadingContent && !artA.content ? (
              <div className="sbs-content-loading">Loading article body...</div>
            ) : artA.content ? (
              <div className="sbs-content-body" data-testid="sbs-article-a-content">
                {artA.content}
              </div>
            ) : (
              <div className="sbs-content-empty">
                <em>Full text content is not provided by the publisher for this article.</em>
              </div>
            )}
          </div>
        </section>

        {/* Column B: Article B */}
        <section
          className="sbs-column sbs-column-b"
          data-testid="sbs-column-article-b"
          aria-label="Article B Details"
        >
          <div className="sbs-column-top">
            <span className="sbs-role-badge">Article B (Matched Story)</span>
            {artB.content_availability && (
              <ContentAvailabilityBadge availability={artB.content_availability} />
            )}
          </div>

          <h4 className="sbs-headline">{artB.title || 'Untitled article'}</h4>

          <div className="sbs-meta-bar">
            {artB.source_name && (
              <span className="sbs-meta-item">
                <span className="sbs-meta-icon" aria-hidden="true">📰</span>
                <strong>{artB.source_name}</strong>
              </span>
            )}
            <span className="sbs-meta-item">
              <span className="sbs-meta-icon" aria-hidden="true">📅</span>
              {formatDate(artB.published_at)}
            </span>
            {artB.url && (
              <a
                href={artB.url}
                target="_blank"
                rel="noreferrer"
                className="sbs-external-link"
                title="Open original article in new tab"
              >
                Original link ↗
              </a>
            )}
          </div>

          <div className="sbs-content-section">
            <div className="sbs-content-label">Article Text / Available Content:</div>
            {isLoadingContent && !artB.content ? (
              <div className="sbs-content-loading">Loading article body...</div>
            ) : artB.content ? (
              <div className="sbs-content-body" data-testid="sbs-article-b-content">
                {artB.content}
              </div>
            ) : (
              <div className="sbs-content-empty">
                <em>Full text content is not provided by the publisher for this article.</em>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Review Functionality Section */}
      <section className="review-panel" aria-label="Classification Review and Feedback">
        <div className="rp-header">
          <h4 className="rp-title">Editorial Classification Review</h4>
          <span className="rp-subtitle">
            Validate whether automated clustering correctly grouped these articles.
          </span>
        </div>

        {/* When review persistence is NOT supported by backend API contract */}
        {!isReviewSupported ? (
          <div className="review-read-only-box" data-testid="review-read-only-notice">
            <div className="rp-ro-header">
              <span className="rp-ro-icon" aria-hidden="true">ℹ️</span>
              <div>
                <strong>Read-Only Review Mode</strong>
                <p className="rp-ro-text">
                  The backend has not yet implemented review update persistence endpoints (e.g. <code>PATCH /api/matches/{'{id}'}/review</code>).
                  Classification labels, similarity scores, and metadata are presented in read-only mode.
                  Review changes cannot be saved to the database at this time.
                </p>
              </div>
            </div>

            <div className="rp-ro-current-summary">
              <div className="rp-summary-item">
                <span className="rp-summary-label">Current Classification:</span>
                <ClassificationBadge label={currentLabel} size="sm" />
              </div>
              <div className="rp-summary-item">
                <span className="rp-summary-label">Review Status:</span>
                <span className="rp-summary-val">{isReviewed ? 'Reviewed' : 'Unreviewed'}</span>
              </div>
              {reviewerNotes && (
                <div className="rp-summary-item">
                  <span className="rp-summary-label">Notes:</span>
                  <span className="rp-summary-val">{reviewerNotes}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* When review updates ARE supported */
          <form className="review-form" onSubmit={handleSaveReview} data-testid="review-edit-form">
            {reviewSuccessMsg && (
              <AlertMessage variant="success" className="rp-feedback-alert">
                {reviewSuccessMsg}
              </AlertMessage>
            )}
            {reviewErrorMsg && (
              <AlertMessage variant="danger" className="rp-feedback-alert">
                {reviewErrorMsg}
              </AlertMessage>
            )}

            <div className="rf-field-group">
              <label className="rf-label" htmlFor="corrected-label-select">
                Classification Label:
              </label>
              <select
                id="corrected-label-select"
                className="form-control form-select rf-select"
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                aria-label="Select classification label"
              >
                <option value="SAME">SAME (Covers identical core event)</option>
                <option value="RELATED">RELATED (Topically related or shared context)</option>
                <option value="DIFFERENT">DIFFERENT (Unrelated events or subjects)</option>
              </select>
            </div>

            <div className="rf-field-group rf-checkbox-group">
              <label className="rf-checkbox-label">
                <input
                  type="checkbox"
                  checked={isReviewed}
                  onChange={(e) => setIsReviewed(e.target.checked)}
                  aria-label="Mark as reviewed"
                />
                <span>Mark pair as manually reviewed by human editor</span>
              </label>
            </div>

            <div className="rf-field-group">
              <label className="rf-label" htmlFor="reviewer-notes-input">
                Reviewer Notes (Optional):
              </label>
              <textarea
                id="reviewer-notes-input"
                className="form-control rf-textarea"
                rows={2}
                placeholder="Add editorial notes or reasoning for this classification..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
              />
            </div>

            <div className="rf-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingReview}
              >
                {isSavingReview ? 'Saving Review...' : 'Save Review'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default SideBySideComparison
