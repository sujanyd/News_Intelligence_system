import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import { fetchToneFraming, TONE_AVAILABLE } from '../api/newsApi'
import { formatPercent, formatToneScore, frameInfo, toneInfo } from '../utils/toneLabels'

/**
 * A bar from −1 (negative words) to +1 (positive words) with a dot at the
 * article's tone score.
 */
function ToneMeter({ score }) {
  if (score === null) return null
  const position = ((score + 1) / 2) * 100 // −1 → 0%, 0 → 50%, +1 → 100%
  return (
    <div className="tf-meter">
      <div
        className="tf-meter-track"
        role="img"
        aria-label={`Tone score ${formatToneScore(score)}, on a scale from −1 (negative) to +1 (positive)`}
      >
        <span className="tf-meter-dot" style={{ left: `${position}%` }} />
      </div>
      <div className="tf-meter-ends" aria-hidden="true">
        <span>−1 negative</span>
        <span>0</span>
        <span>+1 positive</span>
      </div>
    </div>
  )
}

/**
 * One framing signal: the category on top, then the text it was found in
 * (the evidence), then the backend's reason. Category and evidence are kept
 * visibly apart.
 */
function FramingSignalItem({ signal }) {
  const frame = frameInfo(signal.frame_type)
  return (
    <li className="pol-signal tf-signal">
      <div className="pol-signal-header">
        <StatusBadge variant="info">{frame.label}</StatusBadge>
        <span className="pol-technique">
          {signal.from_headline ? 'Found in the headline' : 'Found in the article text'}
        </span>
      </div>
      {frame.meaning && <p className="pol-explanation">{frame.meaning}</p>}
      <p className="pol-evidence-label">Evidence</p>
      <blockquote className="pol-evidence">“{signal.evidence_text}”</blockquote>
      {signal.explanation && <p className="pol-explanation">Why: {signal.explanation}</p>}
    </li>
  )
}

/**
 * ToneFramingSection Component
 *
 * Shows, for one article:
 *   1. Tone: the overall tone of the wording, its score and confidence
 *   2. Headline framing: the angle the headline takes, and the words that show it
 *   3. Article framing: framing signals found in the text, each with its evidence
 *
 * Data: GET /articles/{id}/tone-framing. The first time, the backend analyses
 * the article before it answers. In mock mode nothing is loaded: there is no
 * sample tone or framing data.
 *
 * @param {Object} props
 * @param {number | string} props.articleId - Which article
 * @param {string | null} [props.contentAvailability] - 'full_text', 'summary_only' or 'headline_only'
 */
export function ToneFramingSection({ articleId, contentAvailability = null }) {
  const [analysis, setAnalysis] = useState(null)
  const [isLoading, setIsLoading] = useState(TONE_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!TONE_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchToneFraming(articleId)
      .then((result) => {
        if (isCurrentRequest) setAnalysis(result)
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

  function renderTone() {
    const { tone } = analysis
    const info = toneInfo(tone.label)
    return (
      <div className="tf-block" data-testid="tone-block">
        <h5 className="pol-subheading">Tone</h5>
        <div className="pol-signal-header">
          <StatusBadge variant={info.variant}>{info.label}</StatusBadge>
          {info.meaning && <span className="pol-technique">{info.meaning}</span>}
        </div>
        <ToneMeter score={tone.score} />
        <dl className="details-list tf-details">
          <div>
            <dt>Tone score</dt>
            <dd>{formatToneScore(tone.score)}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{formatPercent(tone.confidence)}</dd>
          </div>
          <div>
            <dt>Headline tone</dt>
            <dd>Not measured separately</dd>
          </div>
        </dl>
        {tone.explanation && <p className="pol-explanation">Why: {tone.explanation}</p>}
      </div>
    )
  }

  function renderHeadlineFraming() {
    const framing = analysis.headline_framing
    return (
      <div className="tf-block" data-testid="headline-framing-block">
        <h5 className="pol-subheading">Headline framing</h5>
        {analysis.headline && (
          <blockquote className="pol-evidence tf-headline">“{analysis.headline}”</blockquote>
        )}
        {framing.frames.length === 0 ? (
          <p className="ai-none">
            No framing cue was found in the headline. That does not prove the headline is
            balanced.
          </p>
        ) : (
          <>
            <ul className="tf-frame-list" aria-label="Headline framing types">
              {framing.frames.map((frame) => (
                <li key={frame}>
                  <StatusBadge variant="info">{frameInfo(frame).label}</StatusBadge>
                  {frame === framing.primary_frame && <span className="pol-technique"> (main)</span>}
                  {frameInfo(frame).meaning && (
                    <span className="pol-technique"> {frameInfo(frame).meaning}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="pol-evidence-label">Evidence: words in the headline that matched</p>
            {framing.evidence_phrases.length > 0 ? (
              <ul className="ai-chip-list" aria-label="Headline evidence words">
                {framing.evidence_phrases.map((phrase) => (
                  <li key={phrase} className="ai-chip">
                    “{phrase}”
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ai-none">The backend did not say which words matched.</p>
            )}
            <dl className="details-list tf-details">
              <div>
                <dt>Confidence</dt>
                <dd>{formatPercent(framing.confidence)}</dd>
              </div>
            </dl>
            {framing.explanation && <p className="pol-explanation">Why: {framing.explanation}</p>}
          </>
        )}
      </div>
    )
  }

  function renderSignals() {
    return (
      <div className="tf-block">
        <h5 className="pol-subheading">Article framing signals</h5>
        {analysis.signals.length > 0 ? (
          <ul className="pol-signal-list" aria-label="Framing signals">
            {analysis.signals.map((signal) => (
              <FramingSignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
        ) : (
          <p className="ai-none">
            No framing signals were found in the text. That does not prove the article is
            balanced.
          </p>
        )}
      </div>
    )
  }

  function renderBody() {
    if (!TONE_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Tone and framing need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There is no sample tone or framing data, so nothing made up is ever shown."
        />
      )
    }
    if (isLoading) {
      return <LoadingState message="Loading tone and framing..." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the tone and framing analysis."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }

    return (
      <>
        {contentAvailability === 'headline_only' && (
          <AlertMessage
            type="info"
            message="Only the headline was collected for this article, so only the headline was analysed."
          />
        )}
        {renderTone()}
        {renderHeadlineFraming()}
        {renderSignals()}
        <p className="ad-section-note">
          Found by matching words from fixed lists, so it can be wrong. Tone is not bias: news
          about a disaster is naturally negative.
        </p>
      </>
    )
  }

  return (
    <section className="ad-section" aria-labelledby="ad-section-tone" data-testid="tone-section">
      <h4 className="ad-section-title" id="ad-section-tone">
        Tone and Framing
      </h4>
      {renderBody()}
    </section>
  )
}

export default ToneFramingSection
