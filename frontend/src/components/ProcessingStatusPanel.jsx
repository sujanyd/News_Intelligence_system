import React from 'react'
import ProcessingStep from './ProcessingStep'
import StatusBadge from './StatusBadge'
import { formatDate } from '../utils/formatDate'

/**
 * Human-friendly content availability label
 */
function formatAvailability(availability) {
  switch (availability) {
    case 'full_text':
      return 'Full text'
    case 'summary_only':
      return 'Summary only'
    case 'headline_only':
      return 'Headline only'
    default:
      return 'Not specified'
  }
}

/**
 * Determines overall processing state
 */
function computeOverallStatus({ embeddings, isLoadingEmbeddings, embeddingsError }) {
  if (embeddingsError) {
    return {
      variant: 'unavailable',
      label: 'Status Check Unavailable',
    }
  }

  if (isLoadingEmbeddings) {
    return {
      variant: 'processing',
      label: 'Checking Processing Status…',
    }
  }

  if (embeddings && embeddings.some((e) => e.status === 'error')) {
    return {
      variant: 'failed',
      label: 'Processing Issue Detected',
    }
  }

  if (embeddings && embeddings.length > 0) {
    return {
      variant: 'completed',
      label: 'Embeddings Generated',
    }
  }

  return {
    variant: 'pending',
    label: 'Collected — Embeddings Pending',
  }
}

/**
 * ProcessingStatusPanel Component
 *
 * Displays the multi-stage pipeline status for a collected article:
 *   1. Collected           (Supported: backend Article record)
 *   2. Preprocessed        (Honest: backend text preprocessing is in-memory; per-article endpoint pending)
 *   3. Embedding Generated (Supported: GET /api/v1/embeddings/article/{id})
 *   4. Ready for Matching  (Honest: awaiting matching endpoint; blocked if embeddings fail/absent)
 *   5. Analysis Pending    (Honest: awaiting AI analysis service)
 *
 * @param {Object} props
 * @param {Object} props.article - The loaded article object
 * @param {Array} [props.embeddings] - List of embeddings from backend
 * @param {boolean} [props.isLoadingEmbeddings=false] - True while fetching embeddings
 * @param {string} [props.embeddingsError=''] - Error message if embedding fetch failed
 * @param {() => void} [props.onRetryEmbeddings] - Retry callback if embedding fetch failed
 */
export function ProcessingStatusPanel({
  article,
  embeddings = [],
  isLoadingEmbeddings = false,
  embeddingsError = '',
  onRetryEmbeddings,
}) {
  if (!article) return null

  const overall = computeOverallStatus({
    embeddings,
    isLoadingEmbeddings,
    embeddingsError,
  })

  // ── Step 1: Collection ───────────────────────────────────────────────────────
  const collectionDetails = (
    <div className="step-metadata-grid">
      <div className="step-meta-item">
        <span className="step-meta-label">Retrieved:</span>
        <span className="step-meta-val">{formatDate(article.retrieved_at)}</span>
      </div>
      <div className="step-meta-item">
        <span className="step-meta-label">Availability:</span>
        <span className="step-meta-val">{formatAvailability(article.content_availability)}</span>
      </div>
      {article.duplicate_of_article_id && (
        <div className="step-meta-item">
          <span className="step-meta-label">Duplicate of:</span>
          <span className="step-meta-val">Article #{article.duplicate_of_article_id}</span>
        </div>
      )}
    </div>
  )

  // ── Step 2: Preprocessing ───────────────────────────────────────────────────
  // Backend has app/services/text_preprocessing.py which cleans text in-memory
  // prior to embedding generation, but no dedicated per-article status endpoint exists yet.
  const preprocessingDescription =
    'Text normalization and cleaning (markup stripping, smart quotes normalization, whitespace collapsing) are performed in-memory during embedding generation. A persistent per-article preprocessing endpoint is not yet exposed by the backend.'

  // ── Step 3: Embeddings ──────────────────────────────────────────────────────
  let embeddingStatus = 'pending'
  let embeddingBadgeLabel = 'Pending'
  let embeddingDescription = 'No vector embeddings generated for this article yet.'
  let embeddingError = null
  let embeddingDetails = null

  if (isLoadingEmbeddings) {
    embeddingStatus = 'processing'
    embeddingBadgeLabel = 'Checking…'
    embeddingDescription = 'Checking backend for existing vector embeddings…'
  } else if (embeddingsError) {
    embeddingStatus = 'unavailable'
    embeddingBadgeLabel = 'Unavailable'
    embeddingDescription = 'Could not verify embedding status with the backend.'
    embeddingError = 'Could not retrieve embedding records from backend.'
  } else if (embeddings && embeddings.length > 0) {
    const hasError = embeddings.some((e) => e.status === 'error')
    if (hasError) {
      embeddingStatus = 'failed'
      embeddingBadgeLabel = 'Failed'
      embeddingDescription =
        'Vector embedding generation encountered an issue. Vector could not be created.'
      const failedItem = embeddings.find((e) => e.status === 'error')
      embeddingError =
        failedItem && failedItem.error
          ? failedItem.error
          : 'Embedding generation failed during processing.'
    } else {
      embeddingStatus = 'completed'
      embeddingBadgeLabel = 'Generated'
      embeddingDescription = `${embeddings.length} vector embedding${
        embeddings.length > 1 ? 's' : ''
      } generated and recorded in the database.`
      embeddingDetails = (
        <div className="step-embeddings-list">
          {embeddings.map((emb, idx) => (
            <div key={idx} className="step-embedding-chip">
              <span className="emb-type">{emb.embedding_type}</span>
              <span className="emb-model">{emb.model_name}</span>
              {emb.dimensions && <span className="emb-dims">{emb.dimensions}d</span>}
            </div>
          ))}
        </div>
      )
    }
  }

  // ── Step 4: Ready for Matching ──────────────────────────────────────────────
  // RULE: Do not claim ready for matching if processing failed or embeddings are absent.
  let matchingStatus = 'pending'
  let matchingBadgeLabel = 'Integration Pending'
  let matchingDescription =
    'Awaiting matching service integration in backend API to cluster articles into semantic events.'

  if (embeddingStatus === 'failed') {
    matchingStatus = 'failed'
    matchingBadgeLabel = 'Blocked'
    matchingDescription =
      'Matching is blocked: Vector embeddings failed generation. Pairwise similarity requires valid vector embeddings.'
  } else if (embeddingStatus === 'pending') {
    matchingStatus = 'pending'
    matchingBadgeLabel = 'Awaiting Embeddings'
    matchingDescription =
      'Matching is pending: Vector embeddings must be generated before semantic similarity matching can occur.'
  } else if (embeddingStatus === 'unavailable' || isLoadingEmbeddings) {
    matchingStatus = 'unavailable'
    matchingBadgeLabel = 'Pending'
    matchingDescription =
      'Matching status will be determined once vector embeddings are verified.'
  } else if (embeddingStatus === 'completed') {
    matchingStatus = 'pending'
    matchingBadgeLabel = 'Integration Pending'
    matchingDescription =
      'Vector embeddings are generated. Story clustering and pairwise matching will be enabled when the matching service is connected.'
  }

  // ── Step 5: AI Analysis ─────────────────────────────────────────────────────
  const analysisStatus = 'unavailable'
  const analysisBadgeLabel = 'Integration Pending'
  const analysisDescription =
    'Awaiting AI analysis service integration. Bias classification, framing signals, and tone divergence will run once article clusters are formed.'

  return (
    <div className="processing-status-panel" data-testid="processing-status-panel">
      <div className="psp-header">
        <div>
          <h4 className="psp-title">Processing Pipeline Status</h4>
          <p className="psp-subtitle">
            Lifecycle stages for collected news articles from retrieval to AI framing analysis.
          </p>
        </div>
        <StatusBadge variant={overall.variant}>{overall.label}</StatusBadge>
      </div>

      {embeddingsError && onRetryEmbeddings && (
        <div className="psp-error-banner" role="alert">
          <span>Could not check embedding records.</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetryEmbeddings}
          >
            Retry Check
          </button>
        </div>
      )}

      <div className="processing-steps-container">
        {/* Step 1: Collection */}
        <ProcessingStep
          stepNumber={1}
          title="Article Collection"
          status="completed"
          badgeLabel="Completed"
          description="Harvested from news source feed and stored in database."
          details={collectionDetails}
          dataTestId="step-collection"
        />

        {/* Step 2: Preprocessing */}
        <ProcessingStep
          stepNumber={2}
          title="Text Preprocessing"
          status="unavailable"
          badgeLabel="Integration Pending"
          description={preprocessingDescription}
          dataTestId="step-preprocessing"
        />

        {/* Step 3: Embedding Generated */}
        <ProcessingStep
          stepNumber={3}
          title="Vector Embeddings"
          status={embeddingStatus}
          badgeLabel={embeddingBadgeLabel}
          description={embeddingDescription}
          details={embeddingDetails}
          error={embeddingError}
          dataTestId="step-embeddings"
        />

        {/* Step 4: Ready for Matching */}
        <ProcessingStep
          stepNumber={4}
          title="Semantic Story Matching"
          status={matchingStatus}
          badgeLabel={matchingBadgeLabel}
          description={matchingDescription}
          dataTestId="step-matching"
        />

        {/* Step 5: Analysis Pending */}
        <ProcessingStep
          stepNumber={5}
          title="AI Framing & Bias Analysis"
          status={analysisStatus}
          badgeLabel={analysisBadgeLabel}
          description={analysisDescription}
          isLast={true}
          dataTestId="step-analysis"
        />
      </div>

      <div className="psp-footer-note">
        <span className="psp-note-icon" aria-hidden="true">ℹ️</span>
        <span className="psp-note-text">
          Active backend services: <strong>Collection</strong> and <strong>Vector Embeddings</strong>. Subsequent stages (Preprocessing status tracking, Semantic Matching, AI Analysis) will update automatically as their backend API endpoints become available.
        </span>
      </div>
    </div>
  )
}

export default ProcessingStatusPanel
