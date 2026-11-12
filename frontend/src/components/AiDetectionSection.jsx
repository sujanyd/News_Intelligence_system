import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import Stamp from './Stamp'
import {
  AI_DETECTION_AVAILABLE,
  AI_FLAG_THRESHOLD,
  fetchAiDetection,
  rerunAiDetection,
} from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { formatPercent } from '../utils/toneLabels'

function formatNumber(value, digits = 2) {
  return value === null || value === undefined ? 'Not given' : value.toFixed(digits)
}

/**
 * AiDetectionSection Component
 *
 * Shows the backend's estimate of how likely the article text is to be
 * machine-generated, with the detector's name, its confidence, the measures
 * it used, and its limitations.
 *
 * Data: GET /articles/{id}/ai-detection (computed the first time);
 * "Check again" uses POST /articles/{id}/ai-detection/analyze.
 *
 * The estimate is never shown as proof. When the backend had too little text
 * it sends a fixed default (5 %); the page then says "not enough text"
 * instead of showing that number as a result.
 *
 * @param {Object} props
 * @param {number | string} props.articleId
 * @param {string | null} [props.contentAvailability] - 'full_text', 'summary_only' or 'headline_only'
 */
export function AiDetectionSection({ articleId, contentAvailability = null }) {
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(AI_DETECTION_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunError, setRerunError] = useState('')

  useEffect(() => {
    if (!AI_DETECTION_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchAiDetection(articleId)
      .then((detection) => {
        if (isCurrentRequest) setResult(detection)
      })
      .catch((error) => {
        if (isCurrentRequest) setErrorMessage(error.message)
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
    setReloadCount(reloadCount + 1)
  }

  async function handleRerun() {
    setIsRerunning(true)
    setRerunError('')
    try {
      setResult(await rerunAiDetection(articleId))
    } catch (error) {
      setRerunError(error.message)
    } finally {
      setIsRerunning(false)
    }
  }

  function renderEstimate() {
    if (result.too_little_text) {
      return (
        <AlertMessage
          type="info"
          title="Not enough text to estimate."
          message="The backend had too little article text to measure, so it sent a fixed default value. That default is not a result and is not shown."
        />
      )
    }
    const percent = Math.round(result.ai_likelihood * 100)
    return (
      <>
        <div className="aid-gauge-row">
          {/* A ring filled to the estimate; the tick marks the backend's review threshold */}
          <div
            className={`aid-gauge${result.is_flagged_for_review ? ' aid-gauge-flagged' : ''}`}
            role="img"
            aria-label={`Estimated AI likelihood ${percent}% on a scale from 0% to 100%`}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {/* Circles start at 3 o'clock; turn them to start at 12 o'clock */}
              <circle className="aid-gauge-track" cx="50" cy="50" r="42" pathLength="100" />
              <circle
                className="aid-gauge-fill"
                cx="50"
                cy="50"
                r="42"
                pathLength="100"
                transform="rotate(-90 50 50)"
                style={{ strokeDasharray: `${percent} 100` }}
              />
              <line
                className="aid-gauge-threshold"
                x1="50"
                y1="3"
                x2="50"
                y2="13"
                transform={`rotate(${AI_FLAG_THRESHOLD * 360} 50 50)`}
              />
            </svg>
            <span className="aid-value">{percent}%</span>
          </div>
          {/* Only when the backend itself flagged the article */}
          {result.is_flagged_for_review && <Stamp label="Review" detail="Flagged by the backend" />}
          <div>
            <p className="aid-caption">Estimated likelihood that the text is machine-generated</p>
            <p className="pol-explanation">
              The tick on the ring marks {Math.round(AI_FLAG_THRESHOLD * 100)}%, where the backend asks a
              person to review the article.
            </p>
          </div>
        </div>
        {/* is_flagged_for_review comes from the backend; no category is made up here */}
        {result.is_flagged_for_review ? (
          <AlertMessage
            type="warning"
            title="Flagged for editorial review."
            message={`The estimate is ${Math.round(
              AI_FLAG_THRESHOLD * 100
            )}% or more, so the backend asks for a person to check this article. This is not proof that it was written by AI.`}
          />
        ) : (
          <div className="cmp-badges">
            <StatusBadge variant="neutral">Not flagged for review</StatusBadge>
          </div>
        )}
        {result.interpretation && <p className="pol-explanation">Backend&apos;s reading: {result.interpretation}</p>}
      </>
    )
  }

  function renderBody() {
    if (!AI_DETECTION_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="AI detection needs the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There is no sample result, so nothing made up is ever shown."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading the AI detection estimate..." />
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the AI detection estimate."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }

    const metrics = result.metrics
    return (
      <>
        {renderEstimate()}

        <dl className="details-list tf-details">
          <div>
            <dt>Confidence</dt>
            <dd>{formatPercent(result.confidence)} (based only on how much text there was)</dd>
          </div>
          <div>
            <dt>Detector</dt>
            <dd>
              {result.model_name || 'Not given'}
              {result.model_version ? ` (version ${result.model_version})` : ''}
            </dd>
          </div>
          <div>
            <dt>Checked on</dt>
            <dd>{formatDate(result.created_at)}</dd>
          </div>
          {contentAvailability && (
            <div>
              <dt>Text checked</dt>
              <dd>
                {contentAvailability === 'full_text'
                  ? 'The full article text'
                  : contentAvailability === 'summary_only'
                  ? 'Only the summary the feed gave'
                  : 'Only the headline'}
              </dd>
            </div>
          )}
        </dl>

        {metrics && !result.too_little_text && (
          <>
            <p className="pol-evidence-label">Measures used</p>
            <dl className="details-list tf-details" aria-label="AI detection measures">
              <div>
                <dt>Sentences checked</dt>
                <dd>{metrics.sentence_count ?? 'Not given'}</dd>
              </div>
              <div>
                <dt>Average sentence length</dt>
                <dd>{formatNumber(metrics.average_sentence_length, 1)} words</dd>
              </div>
              <div>
                <dt>Sentence length variation</dt>
                <dd>{formatNumber(metrics.burstiness)} (higher means more varied, as in most human writing)</dd>
              </div>
              <div>
                <dt>Repeated vocabulary</dt>
                <dd>{formatNumber(metrics.lexical_uniformity)}</dd>
              </div>
              <div>
                <dt>Repeated word pairs</dt>
                <dd>{formatNumber(metrics.repetition_index)}</dd>
              </div>
            </dl>
            {metrics.methodology && <p className="pol-explanation">Method: {metrics.methodology}</p>}
          </>
        )}

        {rerunError && (
          <AlertMessage type="error" title="Could not check the article again." message={rerunError} />
        )}
        <button type="button" className="btn btn-secondary" onClick={handleRerun} disabled={isRerunning}>
          {isRerunning ? 'Checking...' : 'Check again'}
        </button>

        <p className="ad-section-note">
          This is a statistical <strong>estimate</strong>, not proof. It only looks at sentence
          lengths and repeated words, so careful human writing (for example news-agency copy) can
          score high and AI text can score low. It is not a judgement of the article or its
          publisher.
          {result.limitations ? ` Backend note: ${result.limitations}` : ''}
        </p>
      </>
    )
  }

  return (
    <section className="ad-section" aria-labelledby="ad-section-ai" data-testid="ai-detection-section">
      <h4 className="ad-section-title" id="ad-section-ai">
        AI Detection
      </h4>
      {renderBody()}
    </section>
  )
}

export default AiDetectionSection
