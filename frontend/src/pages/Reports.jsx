import React, { useContext, useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import AlertMessage from '../components/AlertMessage'
import DataTable from '../components/DataTable'
import ReportView from '../components/ReportView'
import {
  COMPARISONS_AVAILABLE,
  fetchAllComparisons,
  fetchAllReports,
  generateReport,
} from '../api/newsApi'
import { NavigationContext } from '../navigation'
import { formatDate } from '../utils/formatDate'

const FORMAT_NAMES = { markdown: 'Markdown', html: 'HTML', json: 'JSON' }

/**
 * Reports Page
 *
 * Evidence-based reports saved in the backend:
 *   - list: GET /reports (all pages)
 *   - open: GET /reports/{id} and its comparison (see ReportView)
 *   - generate: POST /reports/generate from a saved comparison
 *     (GET /comparisons lists them)
 *
 * @param {Object} props
 * @param {number} [props.initialReportId] - open this report first
 */
export function Reports({ initialReportId = null }) {
  const navigate = useContext(NavigationContext)
  const [reports, setReports] = useState([])
  const [comparisons, setComparisons] = useState([])
  const [isLoading, setIsLoading] = useState(COMPARISONS_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [openReportId, setOpenReportId] = useState(initialReportId)

  const [comparisonId, setComparisonId] = useState('')
  const [format, setFormat] = useState('markdown')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  useEffect(() => {
    if (!COMPARISONS_AVAILABLE) return undefined
    let isCurrentRequest = true
    Promise.all([fetchAllReports(), fetchAllComparisons()])
      .then(([reportResult, comparisonResult]) => {
        if (!isCurrentRequest) return
        setReports(reportResult.items)
        setComparisons(comparisonResult.items)
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
  }, [reloadCount])

  function reload() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  async function handleGenerate(event) {
    event.preventDefault()
    setIsGenerating(true)
    setGenerateError('')
    try {
      const report = await generateReport({ comparisonId: Number(comparisonId), format })
      setOpenReportId(report.id)
      reload()
    } catch (error) {
      setGenerateError(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const columns = [
    { key: 'title', label: 'Report', render: (report) => <strong>{report.title}</strong> },
    { key: 'comparison', label: 'Comparison', render: (report) => `#${report.comparison_id}` },
    { key: 'format', label: 'Format', render: (report) => FORMAT_NAMES[report.report_format] },
    { key: 'created', label: 'Generated', render: (report) => formatDate(report.created_at) },
    {
      key: 'open',
      label: 'Open',
      render: (report) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpenReportId(report.id)}
          aria-label={`Open report ${report.id}: ${report.title}`}
        >
          Open
        </button>
      ),
    },
  ]

  function renderGenerateForm() {
    if (comparisons.length === 0) {
      return (
        <EmptyState
          title="No saved comparisons yet"
          description="A report is made from a saved comparison. Save one on the Comparisons page first."
          action={
            navigate && (
              <button type="button" className="btn btn-secondary" onClick={() => navigate('comparisons')}>
                Go to Comparisons
              </button>
            )
          }
        />
      )
    }
    return (
      <form className="cmp-report-row" onSubmit={handleGenerate}>
        <label htmlFor="rep-comparison" className="form-label">
          Comparison
        </label>
        <select
          id="rep-comparison"
          className="form-input"
          value={comparisonId}
          onChange={(event) => setComparisonId(event.target.value)}
          required
        >
          <option value="">Choose a comparison...</option>
          {comparisons.map((comparison) => (
            <option key={comparison.id} value={String(comparison.id)}>
              #{comparison.id} {comparison.title} ({comparison.article_count} articles)
            </option>
          ))}
        </select>
        <label htmlFor="rep-format" className="form-label">
          Format
        </label>
        <select id="rep-format" className="form-input" value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="json">JSON</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={isGenerating || !comparisonId}>
          {isGenerating ? 'Generating...' : 'Generate report'}
        </button>
      </form>
    )
  }

  function renderList() {
    if (!COMPARISONS_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Reports need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There are no sample reports."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading reports..." />
    if (errorMessage) {
      return <AlertMessage type="error" title="Could not load the reports." message={errorMessage} onRetry={reload} />
    }
    return (
      <>
        {reports.length === 0 ? (
          <EmptyState title="No reports yet" description="Generate the first one below." />
        ) : (
          <DataTable columns={columns} rows={reports} caption="Saved reports" />
        )}
        <h4 className="pol-subheading">Generate a report</h4>
        {renderGenerateForm()}
        {generateError && (
          <AlertMessage type="error" title="Could not generate the report." message={generateError} />
        )}
      </>
    )
  }

  return (
    <div className="page-reports" data-testid="page-reports">
      <PageHeader
        title="Reports"
        description="Evidence-based reports saved in the backend: publishers, articles, tone and framing differences, facts, topics, political signals, evidence and limitations."
        badge={<StatusBadge variant="info">Backend reports</StatusBadge>}
      />

      {openReportId !== null ? (
        <Card title="Report">
          <ReportView key={openReportId} reportId={openReportId} onBack={() => setOpenReportId(null)} />
        </Card>
      ) : (
        <Card
          title="Available reports"
          subtitle={isLoading || errorMessage || !COMPARISONS_AVAILABLE ? undefined : `${reports.length} saved`}
        >
          {renderList()}
        </Card>
      )}
    </div>
  )
}

export default Reports
