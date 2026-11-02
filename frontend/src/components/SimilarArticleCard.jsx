import React from 'react'
import { formatDate } from '../utils/formatDate'
import { formatSimilarityPercentage } from '../utils/formatSimilarity'

/**
 * SimilarArticleCard Component
 *
 * Displays an individual semantically similar article match:
 *   - Article title
 *   - News source
 *   - Publication date
 *   - Semantic similarity score (formatted as percentage, e.g. "Semantic similarity: 91%")
 *   - Action button to view the article's details
 *
 * NOTE: As per project rules, this component explicitly does NOT label articles
 * as SAME or RELATED, because pairwise classification has not yet been implemented.
 *
 * @param {Object} props
 * @param {Object} props.article - Match object from similarity service
 * @param {number} props.article.article_id - ID of the matched article
 * @param {string} props.article.title - Headline
 * @param {string} [props.article.source_name] - Source/Publisher name
 * @param {string} [props.article.published_at] - Publication timestamp ISO
 * @param {number} props.article.similarity_score - Cosine similarity score (0.0 - 1.0)
 * @param {string} [props.article.url] - External article URL
 * @param {(articleId: number) => void} [props.onSelect] - Called when user clicks "View article"
 */
export function SimilarArticleCard({ article, onSelect }) {
  if (!article) return null

  const similarityPercentage = formatSimilarityPercentage(article.similarity_score)

  function handleSelect() {
    if (onSelect) {
      onSelect(article.article_id)
    }
  }

  return (
    <article
      className="similar-article-card"
      data-testid={`similar-article-card-${article.article_id}`}
    >
      <div className="sac-main">
        <div className="sac-header">
          <h5 className="sac-title">
            <button
              type="button"
              className="sac-title-btn"
              onClick={handleSelect}
              title={`View details for ${article.title}`}
            >
              {article.title}
            </button>
          </h5>

          {similarityPercentage && (
            <div
              className="sac-score-pill"
              title="Cosine similarity score between article text embeddings. Does not imply identical event identity."
              data-testid="similarity-score-pill"
            >
              <span className="sac-score-label">Semantic similarity:</span>
              <strong className="sac-score-val">{similarityPercentage}</strong>
            </div>
          )}
        </div>

        <div className="sac-meta">
          {article.source_name && (
            <span className="sac-meta-item sac-source">
              <span className="sac-meta-icon" aria-hidden="true">📰</span>
              {article.source_name}
            </span>
          )}

          <span className="sac-meta-item sac-date">
            <span className="sac-meta-icon" aria-hidden="true">📅</span>
            {formatDate(article.published_at)}
          </span>

          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="sac-external-link"
              title="Open original published article"
            >
              Original link ↗
            </a>
          )}
        </div>
      </div>

      <div className="sac-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleSelect}
          aria-label={`View article: ${article.title}`}
        >
          View article →
        </button>
      </div>
    </article>
  )
}

export default SimilarArticleCard
