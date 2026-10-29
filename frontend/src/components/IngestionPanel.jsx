import React, { useState } from 'react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import AlertMessage from './AlertMessage'
import DataTable from './DataTable'

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
 * @param {boolean} props.isAvailable - false when collection cannot run (e.g. mock mode)
 * @param {string} [props.unavailableReason] - shown under the disabled button
 * @param {() => Promise<{ counts: Array, feeds: Array }>} props.onRun - starts one run
 * @param {() => void} [props.onSuccess] - called after a successful run (to reload the lists)
 */
export function IngestionPanel({ isAvailable, unavailableReason, onRun, onSuccess }) {
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

  // One row per feed in the result table
  const feedColumns = [
    { key: 'source_name', label: 'Feed', render: (feed) => <strong>{feed.source_name}</strong> },
    {
      key: 'status',
      label: 'Status',
      render: (feed) => {
        if (feed.status === 'success') return <StatusBadge variant="success">Success</StatusBadge>
        if (feed.status === 'error') return <StatusBadge variant="warning">Failed</StatusBadge>
        return feed.status || 'Not provided'
      },
    },
    {
      key: 'articles_inserted',
      label: 'New',
      render: (feed) => (feed.articles_inserted === null ? 'Not provided' : feed.articles_inserted),
    },
    {
      key: 'articles_skipped_duplicate',
      label: 'Duplicates',
      render: (feed) =>
        feed.articles_skipped_duplicate === null ? 'Not provided' : feed.articles_skipped_duplicate,
    },
    { key: 'error', label: 'Error', render: (feed) => feed.error || '-' },
  ]

  const statusBadge = isAvailable ? (
    <StatusBadge variant="success">Live backend</StatusBadge>
  ) : (
    <StatusBadge variant="warning">Not available</StatusBadge>
  )

  return (
    <Card
      title="News Collection"
      subtitle="Fetch the latest articles from the backend's RSS feeds"
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

      {isRunning && (
        <p className="ingestion-note" role="status">
          Reading every RSS feed. This can take up to a minute.
        </p>
      )}

      {!isAvailable && unavailableReason && <p className="ingestion-note">{unavailableReason}</p>}

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

          {result.feeds.length > 0 && (
            <div className="ingestion-feeds">
              <h4 className="details-heading">Result for each feed</h4>
              <DataTable columns={feedColumns} rows={result.feeds} caption="Result for each feed" />
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
