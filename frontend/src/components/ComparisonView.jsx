import React, { useContext, useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import DataTable from './DataTable'
import StatusBadge from './StatusBadge'
import ArticleDetails from './ArticleDetails'
import CoverageAnalysis from './CoverageAnalysis'
import { fetchComparisonWithEvent, generateReport } from '../api/newsApi'
import { NavigationContext } from '../navigation'
import { formatDate } from '../utils/formatDate'
import { formatToneScore, frameInfo } from '../utils/toneLabels'
import { EVIDENCE_TYPE_LABELS } from '../utils/comparisonLabels'

/**
 * The parts of a saved comparison, shared by the comparison page and the
 * report page:
 *   1. The articles being compared (with their details on request)
 *   2. The backend's comparison results per article, and its observations
 *   3. The full analysis of the articles (CoverageAnalysis)
 *
 * @param {Object} props
 * @param {Object} props.comparison - from toComparison
 * @param {Array} props.events
 */
export function ComparisonBody({ comparison, events }) {
  const [openArticleId, setOpenArticleId] = useState(null)
  const articleById = new Map(comparison.articles.map((article) => [article.id, article]))

  const coverageColumns = [
    {
      key: 'source',
      label: 'Publisher',
      render: (row) => row.source_name || articleById.get(row.article_id)?.source_name || 'Unknown',
    },
    {
      key: 'title',
      label: 'Headline',
      render: (row) => <strong>{row.article_title || articleById.get(row.article_id)?.title}</strong>,
    },
    { key: 'tone', label: 'Tone score', render: (row) => formatToneScore(row.tone_score) },
    {
      key: 'frame',
      label: 'Headline framing',
      render: (row) =>
        !row.primary_frame || row.primary_frame === 'neutral_reporting'
          ? 'No cue found'
          : frameInfo(row.primary_frame).label,
    },
    {
      key: 'omitted',
      label: 'Topics the others mention',
      render: (row) => row.omitted_topics || 'None',
    },
    {
      key: 'length',
      label: 'Text length score',
      render: (row) => (row.text_length_score === null ? 'Not given' : row.text_length_score.toFixed(2)),
    },
  ]

  return (
    <>
      <section className="ad-section" aria-labelledby="cmp-articles-title">
        <h4 className="ad-section-title" id="cmp-articles-title">Articles being compared</h4>
        <ul className="cmp-article-list" aria-label="Articles being compared">
          {comparison.articles.map((article, index) => (
            <li key={article.id}>
              <div className="cmp-article-head">
                <StatusBadge variant="primary">Article {index + 1}</StatusBadge>
                <strong>{article.source_name || 'Unknown publisher'}</strong>
                <span className="ai-chip-extra">{formatDate(article.published_at)}</span>
              </div>
              <p className="cmp-headline">{article.title}</p>
              <div className="cmp-badges">
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={openArticleId === article.id}
                  onClick={() => setOpenArticleId(openArticleId === article.id ? null : article.id)}
                >
                  {openArticleId === article.id ? 'Hide article' : 'Read article'}
                </button>
                {article.url && (
                  <a href={article.url} target="_blank" rel="noreferrer" className="table-link">
                    Original article ↗
                  </a>
                )}
              </div>
              {openArticleId === article.id && (
                <ArticleDetails
                  articleId={article.id}
                  sourceName={article.source_name}
                  onClose={() => setOpenArticleId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="ad-section" aria-labelledby="cmp-backend-title">
        <h4 className="ad-section-title" id="cmp-backend-title">Backend comparison results</h4>
        {comparison.coverages.length > 0 ? (
          <DataTable
            columns={coverageColumns}
            rows={comparison.coverages}
            caption="Backend comparison results per article"
          />
        ) : (
          <p className="ai-none">The backend sent no per-article results.</p>
        )}
        <p className="pol-explanation">
          &quot;Text length score&quot; is computed by the backend from the length of the article text
          only; it does not measure how well a story is covered.
        </p>

        <p className="pol-evidence-label">Backend observations</p>
        {comparison.evidences.length > 0 ? (
          <ul className="rep-evidence-list" aria-label="Backend observations">
            {comparison.evidences.map((evidence) => (
              <li key={evidence.id}>
                <StatusBadge variant="info">
                  {EVIDENCE_TYPE_LABELS[evidence.evidence_type] || evidence.evidence_type || 'Observation'}
                </StatusBadge>
                <p className="pol-explanation">{evidence.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-none">
            No differences in headline framing or tone were found between these articles.
          </p>
        )}
        <p className="pol-explanation">
          These sentences are written by the backend when two headlines have different main frames, or
          two tone scores differ by 0.35 or more. They are not quotes from the articles.
        </p>
      </section>

      <CoverageAnalysis
        articles={comparison.articles}
        events={events}
        extraLimitations={[
          'The backend also stores a left/right "leaning" for each article; it is not shown, because it comes from a fixed table of party positions.',
        ]}
      />
    </>
  )
}

/**
 * ComparisonView Component
 *
 * One saved comparison (GET /comparisons/{id}), with a button to generate a
 * report from it (POST /reports/generate).
 *
 * @param {Object} props
 * @param {number} props.comparisonId
 * @param {() => void} props.onBack
 */
export function ComparisonView({ comparisonId, onBack }) {
  const navigate = useContext(NavigationContext)
  const [data, setData] = useState(null) // { comparison, events }
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  const [format, setFormat] = useState('markdown')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [newReport, setNewReport] = useState(null)

  useEffect(() => {
    let isCurrentRequest = true
    fetchComparisonWithEvent(comparisonId)
      .then((result) => {
        if (isCurrentRequest) setData(result)
      })
      .catch((error) => {
        if (isCurrentRequest) setErrorMessage(error.message)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [comparisonId, reloadCount])

  function handleRetry() {
    setErrorMessage('')
    setData(null)
    setReloadCount(reloadCount + 1)
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError('')
    setNewReport(null)
    try {
      setNewReport(await generateReport({ comparisonId, format }))
    } catch (error) {
      setGenerateError(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const backButton = (
    <button type="button" className="btn btn-secondary story-back" onClick={onBack}>
      ← All comparisons
    </button>
  )

  if (errorMessage) {
    return (
      <>
        {backButton}
        <AlertMessage type="error" title="Could not load the comparison." message={errorMessage} onRetry={handleRetry} />
      </>
    )
  }
  if (!data) {
    return (
      <>
        {backButton}
        <LoadingState message="Loading the comparison..." />
      </>
    )
  }

  const { comparison, events } = data
  return (
    <article data-testid="comparison-view">
      {backButton}
      <h3 className="rep-title">{comparison.title}</h3>
      <p className="ai-chip-extra">
        Comparison #{comparison.id} · saved {formatDate(comparison.created_at)}
        {comparison.status ? ` · ${comparison.status}` : ''}
      </p>
      {comparison.description && <p className="pol-explanation">{comparison.description}</p>}

      <section className="ad-section" aria-labelledby="cmp-report-title">
        <h4 className="ad-section-title" id="cmp-report-title">Report</h4>
        <div className="cmp-report-row">
          <label htmlFor="cmp-report-format" className="form-label">
            Report format
          </label>
          <select
            id="cmp-report-format"
            className="form-input"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate a report'}
          </button>
        </div>
        {generateError && (
          <AlertMessage type="error" title="Could not generate the report." message={generateError} />
        )}
        {newReport && (
          <AlertMessage
            type="success"
            title={`Report #${newReport.id} saved.`}
            message={newReport.title}
          />
        )}
        {newReport && navigate && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('reports', { reportId: newReport.id })}
          >
            Open report #{newReport.id}
          </button>
        )}
      </section>

      <ComparisonBody comparison={comparison} events={events} />
    </article>
  )
}

export default ComparisonView
