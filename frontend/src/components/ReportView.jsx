import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import StatusBadge from './StatusBadge'
import Stamp from './Stamp'
import { ComparisonBody } from './ComparisonView'
import { fetchComparisonWithEvent, fetchReport } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'
import { REPORT_FILE_TYPES, saveTextFile } from '../utils/download'

const FORMAT_NAMES = { markdown: 'Markdown', html: 'HTML', json: 'JSON' }

/**
 * ReportView Component
 *
 * One saved report (GET /reports/{id}) and the comparison it was made from
 * (GET /comparisons/{comparison_id}).
 *
 * - The report's structured content is shown with the app's own components
 *   (ComparisonBody), so every result has its evidence and limitations.
 * - The backend's own report text is shown as plain text (never as HTML: the
 *   backend does not escape article titles in its HTML) and can be
 *   downloaded exactly as the backend wrote it.
 *
 * @param {Object} props
 * @param {number} props.reportId
 * @param {() => void} props.onBack
 */
export function ReportView({ reportId, onBack }) {
  const [report, setReport] = useState(null)
  const [comparisonData, setComparisonData] = useState(null) // { comparison, events }
  const [comparisonError, setComparisonError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    async function load() {
      const loadedReport = await fetchReport(reportId)
      if (!isCurrentRequest) return
      setReport(loadedReport)
      try {
        const data = await fetchComparisonWithEvent(loadedReport.comparison_id)
        if (isCurrentRequest) setComparisonData(data)
      } catch (error) {
        // The report text is still worth showing without its comparison
        if (isCurrentRequest) setComparisonError(error.message)
      }
    }
    load().catch((error) => {
      if (isCurrentRequest) setErrorMessage(error.message)
    })
    return () => {
      isCurrentRequest = false
    }
  }, [reportId, reloadCount])

  function handleRetry() {
    setErrorMessage('')
    setComparisonError('')
    setReport(null)
    setComparisonData(null)
    setReloadCount(reloadCount + 1)
  }

  function handleDownload() {
    const fileType = REPORT_FILE_TYPES[report.report_format]
    saveTextFile(`report-${report.id}.${fileType.extension}`, report.content, fileType.mimeType)
  }

  const backButton = (
    <button type="button" className="btn btn-secondary story-back" onClick={onBack}>
      ← All reports
    </button>
  )

  if (errorMessage) {
    return (
      <>
        {backButton}
        <AlertMessage type="error" title="Could not load the report." message={errorMessage} onRetry={handleRetry} />
      </>
    )
  }
  if (!report) {
    return (
      <>
        {backButton}
        <LoadingState message="Loading the report..." />
      </>
    )
  }

  return (
    <article data-testid="report-view">
      {backButton}
      <div className="rep-head">
        <h3 className="rep-title">{report.title}</h3>
        {/* The backend saved this report on this date */}
        <Stamp label="Filed" detail={formatDate(report.created_at)} />
      </div>
      <p className="ai-chip-extra">
        Report #{report.id} · generated {formatDate(report.created_at)} · from comparison #
        {report.comparison_id}
      </p>

      <section className="ad-section" aria-labelledby="rep-backend-title">
        <h4 className="ad-section-title" id="rep-backend-title">Backend report</h4>
        {report.summary && <p className="pol-explanation">{report.summary}</p>}
        <div className="cmp-badges">
          <StatusBadge variant="neutral">{FORMAT_NAMES[report.report_format]}</StatusBadge>
          <button type="button" className="btn btn-secondary" onClick={handleDownload}>
            Download ({FORMAT_NAMES[report.report_format]})
          </button>
        </div>
        <details className="rep-evidence">
          <summary>Show the report text as the backend wrote it</summary>
          <pre className="rep-raw">{report.content}</pre>
        </details>
        <p className="pol-explanation">
          The backend&apos;s text includes a left/right &quot;leaning&quot; for each publisher. It comes from
          a fixed table of party positions and a few articles; it is not evidence of a
          publisher&apos;s politics, so the sections below leave it out.
        </p>
      </section>

      {comparisonError && (
        <AlertMessage
          type="warning"
          title="The comparison behind this report could not be loaded."
          message={comparisonError}
          onRetry={handleRetry}
        />
      )}
      {!comparisonData && !comparisonError && <LoadingState message="Loading the comparison..." />}
      {comparisonData && (
        <ComparisonBody comparison={comparisonData.comparison} events={comparisonData.events} />
      )}
    </article>
  )
}

export default ReportView
