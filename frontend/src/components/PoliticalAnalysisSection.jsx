import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import DataTable from './DataTable'
import { PoliticalSignalItem, PresentationBadge } from './PoliticalSignalParts'
import { fetchPoliticalAnalysis, POLITICAL_AVAILABLE } from '../api/newsApi'
import { categoryLabel } from '../utils/politicalLabels'
import { formatDate } from '../utils/formatDate'

/**
 * PoliticalAnalysisSection Component
 *
 * Shows the political entities the backend found in one article and the
 * sentences where they are worded favorably or critically.
 *
 * Data: GET /articles/{id}/political-signals. The first time, the backend
 * analyses the article before it answers.
 *
 * On purpose this does NOT show the backend's left/right "leaning" or its
 * confidence numbers (see toPoliticalAnalysis in normalize.js for why).
 * In mock mode nothing is loaded: there are no sample politicians.
 *
 * @param {Object} props
 * @param {number | string} props.articleId - Which article
 */
export function PoliticalAnalysisSection({ articleId }) {
  const [analysis, setAnalysis] = useState(null)
  const [isLoading, setIsLoading] = useState(POLITICAL_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!POLITICAL_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchPoliticalAnalysis(articleId)
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

  const entityColumns = [
    { key: 'name', label: 'Entity', render: (entity) => <strong>{entity.name}</strong> },
    { key: 'type', label: 'Type', render: (entity) => categoryLabel(entity.political_category) },
    {
      key: 'affiliation',
      label: 'Known affiliation',
      render: (entity) => entity.affiliation || 'Not known',
    },
    {
      key: 'mentions',
      label: 'Mentions',
      render: (entity) => (entity.mention_count === null ? 'Not given' : entity.mention_count),
    },
    {
      key: 'presentation',
      label: 'Wording',
      render: (entity) => <PresentationBadge presentation={entity.presentation} />,
    },
  ]

  function renderBody() {
    if (!POLITICAL_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Political analysis needs the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server. There is no sample political data, so nothing made up is ever shown."
        />
      )
    }
    if (isLoading) {
      return <LoadingState message="Loading political analysis..." />
    }
    if (errorMessage) {
      return (
        <AlertMessage
          type="error"
          title="Could not load the political analysis."
          message={errorMessage}
          onRetry={handleRetry}
        />
      )
    }
    if (analysis.entities.length === 0) {
      return (
        <EmptyState
          title="No political entities found"
          description="The backend found no politician, party or political organization from its list in this article."
        />
      )
    }

    return (
      <>
        <h5 className="pol-subheading">Political entities</h5>
        <DataTable
          columns={entityColumns}
          rows={analysis.entities}
          caption="Political entities in this article"
        />

        <h5 className="pol-subheading">Wording signals</h5>
        {analysis.signals.length > 0 ? (
          <ul className="pol-signal-list" aria-label="Wording signals">
            {analysis.signals.map((signal) => (
              <PoliticalSignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
        ) : (
          <p className="ai-none">
            No favorable or critical wording was found near these names. That does not prove the
            article is neutral.
          </p>
        )}

        <p className="ad-section-note">
          Found automatically by the backend
          {analysis.analyzed_at ? ` on ${formatDate(analysis.analyzed_at)}` : ''}, by matching
          words from fixed lists (for example &quot;praised&quot; or &quot;criticized&quot;) in
          sentences that mention a name. It can be wrong: the word may be about someone else.
          Critical wording is not proof of bias, and one article says nothing about a
          publisher&apos;s politics. The backend&apos;s confidence numbers are not shown because
          they are the same for every result.
        </p>
      </>
    )
  }

  return (
    <section
      className="ad-section"
      aria-labelledby="ad-section-political"
      data-testid="political-section"
    >
      <h4 className="ad-section-title" id="ad-section-political">
        Political Analysis
      </h4>
      {renderBody()}
    </section>
  )
}

export default PoliticalAnalysisSection
