import React, { useState } from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import AlertMessage from './AlertMessage'

/**
 * IngestionPanel Component
 *
 * The "Run News Collection" button and the result of the last run.
 *
 * - While a run is going, the button is disabled, so it cannot be started twice.
 * - Only the numbers the backend really sent are shown.
 * - The result is only kept while this page is open: the backend does not
 *   save a history of runs (yet).
 *
 * @param {Object} props
 * @param {boolean} props.isAvailable - false when the backend has no collection endpoint
 * @param {() => Promise<{ counts: Array, errors: string[] | null }>} props.onRun - starts one run
 * @param {() => void} [props.onSuccess] - called after a successful run (to reload articles)
 */
export function IngestionPanel({ isAvailable, onRun, onSuccess }) {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleRun() {
    if (isRunning) return // a run is already going
    setIsRunning(true)
    setResult(null)
    setErrorMessage('')
    try {
      const runResult = await onRun()
      setResult(runResult)
      if (onSuccess) onSuccess()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsRunning(false)
    }
  }

  const statusBadge = isAvailable ? (
    <StatusBadge variant="success">Endpoint ready</StatusBadge>
  ) : (
    <StatusBadge variant="warning">Waiting for backend</StatusBadge>
  )

  return (
    <Card
      title="News Collection"
      subtitle="Fetch the latest articles from the RSS feeds of the configured sources"
      badge={statusBadge}
    >
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleRun}
        disabled={!isAvailable || isRunning}
        aria-busy={isRunning}
      >
        {isRunning ? (
          <span className="loading-spinner-wrap">
            <span className="spinner" aria-hidden="true" /> Collecting news...
          </span>
        ) : (
          'Run News Collection'
        )}
      </button>

      {!isAvailable && (
        <p className="ingestion-note">
          Not available yet: the backend does not have a news collection endpoint.
          The button will work once Person A adds it.
        </p>
      )}

      {errorMessage && (
        <AlertMessage type="error" title="News collection failed." message={errorMessage} />
      )}

      {result && (
        <div className="ingestion-result">
          <AlertMessage type="success" message="News collection finished." />

          {result.counts.length > 0 ? (
            <dl className="ingestion-counts">
              {result.counts.map((count) => (
                <div key={count.key}>
                  <dt>{count.label}</dt>
                  <dd>{count.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="ingestion-note">The backend did not send any counts for this run.</p>
          )}

          {result.errors !== null && (
            <div className="ingestion-errors">
              <h4 className="details-heading">Feed errors ({result.errors.length})</h4>
              {result.errors.length === 0 ? (
                <p className="ingestion-note">No feed errors.</p>
              ) : (
                <ul>
                  {result.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="ingestion-note">
            This is the result of the run you just started. It is not saved, so it
            disappears when you leave this page.
          </p>
        </div>
      )}
    </Card>
  )
}

export default IngestionPanel
