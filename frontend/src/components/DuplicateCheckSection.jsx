import React, { useState } from 'react'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import { DUPLICATE_CHECK_AVAILABLE, checkArticleDuplicates } from '../api/newsApi'
import { formatSimilarityPercentage } from '../utils/formatSimilarity'

// What each duplicate type means, in plain words
const TYPE_TEXT = {
  exact: 'Exact duplicate (same address or the same text)',
  near_duplicate: 'Near-duplicate (almost the same text, e.g. a republished wire story)',
  none: 'No duplicate found',
}

/**
 * DuplicateCheckSection Component
 *
 * Shows whether the backend knows this article as a copy of an earlier one
 * (duplicate_of_article_id), and lets the user run the exact /
 * near-duplicate check. The check stores its link in the backend, so it
 * only runs when the user presses the button.
 *
 * Data: POST /articles/{id}/detect-duplicates
 *
 * @param {Object} props
 * @param {number | string} props.articleId
 * @param {number | null} [props.duplicateOfArticleId] - stored link from the article itself
 * @param {(id: number) => void} [props.onOpenArticle] - opens the earlier article
 */
export function DuplicateCheckSection({ articleId, duplicateOfArticleId = null, onOpenArticle }) {
  const [result, setResult] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleCheck() {
    setIsChecking(true)
    setErrorMessage('')
    try {
      setResult(await checkArticleDuplicates(articleId))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsChecking(false)
    }
  }

  // The earlier article: from the check when it ran, otherwise the stored link.
  // When the check says THIS article is the original, there is nothing to open.
  const checkedOriginal =
    result && result.canonical_article_id !== Number(articleId) ? result.canonical_article_id : null
  const originalId = result ? checkedOriginal : duplicateOfArticleId

  function renderOpenButton() {
    if (!originalId) return null
    if (!onOpenArticle) return <span> Earlier article: #{originalId}</span>
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenArticle(originalId)}>
        Open the earlier article (#{originalId})
      </button>
    )
  }

  return (
    <section className="ad-section" aria-labelledby={`ad-section-duplicates-${articleId}`}>
      <h4 className="ad-section-title" id={`ad-section-duplicates-${articleId}`}>
        Duplicate Check
      </h4>

      {!DUPLICATE_CHECK_AVAILABLE ? (
        <p className="ai-none">The duplicate check needs the real backend.</p>
      ) : (
        <>
          {!result && (
            <p data-testid="duplicate-status">
              {duplicateOfArticleId ? (
                <StatusBadge variant="warning">Marked as a copy of an earlier article</StatusBadge>
              ) : (
                'Not marked as a duplicate.'
              )}{' '}
              {renderOpenButton()}
            </p>
          )}

          {result && (
            <p data-testid="duplicate-result">
              <StatusBadge variant={result.is_duplicate ? 'warning' : 'success'}>
                {TYPE_TEXT[result.duplicate_type]}
              </StatusBadge>
              {result.is_duplicate && result.similarity_score !== null && (
                <span className="ai-chip-extra">
                  {' '}
                  Text overlap {formatSimilarityPercentage(result.similarity_score)}
                </span>
              )}{' '}
              {renderOpenButton()}
              {result.reason && <span className="ad-section-note"> {result.reason}</span>}
            </p>
          )}

          {errorMessage && (
            <AlertMessage type="error" title="Could not check for duplicates." message={errorMessage} />
          )}

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCheck} disabled={isChecking}>
            {isChecking ? 'Checking...' : result ? 'Check again' : 'Check for duplicates'}
          </button>
          <p className="ad-section-note">
            Compares this article with up to 50 others (the same event first). A duplicate is a
            copy of the text, not a judgement of the article.
          </p>
        </>
      )}
    </section>
  )
}

export default DuplicateCheckSection
