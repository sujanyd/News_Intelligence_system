import React from 'react'
import ClassificationBadge from './ClassificationBadge'
import { formatDate } from '../utils/formatDate'
import { formatSimilarityPercentage } from '../utils/formatSimilarity'

/**
 * MatchedPairCard Component
 *
 * Displays a summary card for a pairwise article match:
 *   - Original article title (Article A) + Source + Publication date
 *   - Matched article title (Article B) + Source + Publication date
 *   - Classification label (SAME, RELATED, DIFFERENT) via ClassificationBadge
 *   - Similarity score (if available) - formatted separately as semantic closeness
 *   - Classification confidence (if available) - formatted separately as model confidence
 *   - Review status indicator
 *   - "Compare Side-by-Side →" action button
 *
 * @param {Object} props
 * @param {Object} props.match - Normalized ArticleMatch object
 * @param {(match: Object) => void} [props.onCompare] - Callback to open side-by-side comparison
 */
export function MatchedPairCard({ match, onCompare }) {
  if (!match) return null

  const {
    id,
    article_a: articleA = {},
    article_b: articleB = {},
    match_label,
    similarity_score,
    confidence_score,
    model_name,
    review_status,
  } = match

  const similarityFormatted = formatSimilarityPercentage(similarity_score)
  const confidenceFormatted =
    typeof confidence_score === 'number' && !Number.isNaN(confidence_score)
      ? `${Math.round(confidence_score * 100)}%`
      : null

  const isReviewed = String(review_status).toLowerCase() === 'reviewed'

  function handleCompare() {
    if (onCompare) {
      onCompare(match)
    }
  }

  return (
    <article
      className="matched-pair-card"
      data-testid={`matched-pair-card-${id}`}
      data-label={match_label}
    >
      <div className="mpc-top-bar">
        <div className="mpc-classification-group">
          <ClassificationBadge label={match_label} />
          <span
            className={`mpc-review-badge ${isReviewed ? 'mpc-reviewed' : 'mpc-unreviewed'}`}
            title={isReviewed ? 'Manually reviewed by human editor' : 'Unreviewed by human editor'}
            data-testid="mpc-review-status"
          >
            {isReviewed ? '✓ Reviewed' : '○ Unreviewed'}
          </span>
        </div>

        <div className="mpc-metrics-group">
          <div
            className={`mpc-metric-pill${similarityFormatted ? '' : ' mpc-metric-na'}`}
            title="Semantic closeness measured by vector embeddings (0% to 100%). Does not imply identical event identity."
            data-testid="mpc-similarity-pill"
          >
            <span className="mpc-metric-label">Similarity:</span>
            {similarityFormatted
              ? <strong className="mpc-metric-val">{similarityFormatted}</strong>
              : <span className="mpc-metric-val">N/A</span>
            }
          </div>

          <div
            className={`mpc-metric-pill${confidenceFormatted ? '' : ' mpc-metric-na'}`}
            title="Statistical confidence in the assigned classification label (0% to 100%)."
            data-testid="mpc-confidence-pill"
          >
            <span className="mpc-metric-label">Confidence:</span>
            {confidenceFormatted
              ? <strong className="mpc-metric-val">{confidenceFormatted}</strong>
              : <span className="mpc-metric-val">N/A</span>
            }
          </div>
        </div>
      </div>

      <div className="mpc-body-grid">
        {/* Article A Preview */}
        <div className="mpc-article-item mpc-article-a">
          <div className="mpc-article-header">
            <span className="mpc-article-role">Article A (Original)</span>
            {articleA.source_name && (
              <span className="mpc-source-tag">
                <span aria-hidden="true">📰</span>{' '}{articleA.source_name}
              </span>
            )}
          </div>
          <h4 className="mpc-article-title">{articleA.title || 'Untitled article'}</h4>
          <div className="mpc-article-meta">
            <span className="mpc-date">📅 {formatDate(articleA.published_at)}</span>
            {articleA.url && (
              <a
                href={articleA.url}
                target="_blank"
                rel="noreferrer"
                className="mpc-link"
                title="Open external article link"
              >
                Original ↗
              </a>
            )}
          </div>
        </div>

        <div className="mpc-divider-icon" aria-hidden="true">
          <span>vs</span>
        </div>

        {/* Article B Preview */}
        <div className="mpc-article-item mpc-article-b">
          <div className="mpc-article-header">
            <span className="mpc-article-role">Article B (Matched)</span>
            {articleB.source_name && (
              <span className="mpc-source-tag">📰 {articleB.source_name}</span>
            )}
          </div>
          <h4 className="mpc-article-title">{articleB.title || 'Untitled article'}</h4>
          <div className="mpc-article-meta">
            <span className="mpc-date">📅 {formatDate(articleB.published_at)}</span>
            {articleB.url && (
              <a
                href={articleB.url}
                target="_blank"
                rel="noreferrer"
                className="mpc-link"
                title="Open external article link"
              >
                Original ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mpc-footer">
        <div className="mpc-method-note">
          {model_name ? (
            <span className="mpc-method-text" title="Matching method / model used">
              Model: <code>{model_name}</code>
            </span>
          ) : (
            <span className="mpc-method-text mpc-method-na">Method: Not specified</span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm mpc-compare-btn"
          onClick={handleCompare}
          aria-label={`Compare side-by-side: ${articleA.title || 'Article A'} and ${articleB.title || 'Article B'}`}
        >
          Compare Side-by-Side →
        </button>
      </div>
    </article>
  )
}

export default MatchedPairCard
