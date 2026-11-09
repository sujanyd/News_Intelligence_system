import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { PoliticalSignalItem, PresentationBadge } from './PoliticalSignalParts'
import { fetchPoliticalAnalysis, POLITICAL_AVAILABLE } from '../api/newsApi'
import { categoryLabel, compareCoverage } from '../utils/politicalLabels'

// "BBC News (Article A)" or just "Article A"
function sideName(article, letter) {
  return article.source_name ? `${article.source_name} (Article ${letter})` : `Article ${letter}`
}

/**
 * How one article presents one entity: its badge and its evidence sentences.
 */
function CoverageCell({ side }) {
  return (
    <div className="pol-cell">
      <PresentationBadge presentation={side.entity.presentation} />
      {side.signals.length > 0 ? (
        <ul className="pol-signal-list">
          {side.signals.map((signal) => (
            <PoliticalSignalItem key={signal.id} signal={signal} showEntity={false} />
          ))}
        </ul>
      ) : (
        <p className="ai-none">No favorable or critical wording found.</p>
      )}
    </div>
  )
}

/**
 * PoliticalCoverageComparison Component
 *
 * Shown under a matched article pair on the Comparisons page. Loads the
 * political analysis of both articles (GET /articles/{id}/political-signals,
 * once each) and lines them up:
 *   - Entities named in BOTH articles: how each article words them, with evidence
 *   - Entities named in only one article
 *
 * It compares two articles, not two publishers: one article is never used to
 * say a publisher is biased.
 *
 * @param {Object} props
 * @param {{ id: number, source_name?: string }} props.articleA
 * @param {{ id: number, source_name?: string }} props.articleB
 */
export function PoliticalCoverageComparison({ articleA, articleB }) {
  const [analyses, setAnalyses] = useState(null) // { a, b }; a side is null if it failed
  const [isLoading, setIsLoading] = useState(POLITICAL_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!POLITICAL_AVAILABLE) return undefined
    let isCurrentRequest = true
    Promise.allSettled([fetchPoliticalAnalysis(articleA.id), fetchPoliticalAnalysis(articleB.id)])
      .then(([resultA, resultB]) => {
        if (!isCurrentRequest) return
        if (resultA.status === 'rejected' && resultB.status === 'rejected') {
          setErrorMessage(resultA.reason.message)
          return
        }
        setAnalyses({
          a: resultA.status === 'fulfilled' ? resultA.value : null,
          b: resultB.status === 'fulfilled' ? resultB.value : null,
        })
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [articleA.id, articleB.id, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setAnalyses(null)
    setReloadCount(reloadCount + 1)
  }

  const nameA = sideName(articleA, 'A')
  const nameB = sideName(articleB, 'B')

  function renderEntityNames(entities) {
    return entities.length > 0 ? entities.map((entity) => entity.name).join(', ') : 'None'
  }

  function renderBody() {
    if (!POLITICAL_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Political coverage needs the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server."
        />
      )
    }
    if (isLoading) {
      return <LoadingState message="Loading political analysis of both articles..." />
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
    if (!analyses.a || !analyses.b) {
      const failed = analyses.a ? nameB : nameA
      return (
        <AlertMessage
          type="warning"
          title="Only one article could be analysed."
          message={`The political analysis of ${failed} could not be loaded, so the two cannot be compared.`}
          onRetry={handleRetry}
        />
      )
    }

    const { shared, onlyA, onlyB } = compareCoverage(analyses.a, analyses.b)
    if (shared.length === 0 && onlyA.length === 0 && onlyB.length === 0) {
      return (
        <EmptyState
          title="No political entities in either article"
          description="The backend found no politician, party or political organization from its list in these two articles."
        />
      )
    }

    return (
      <>
        {shared.length > 0 ? (
          <div className="pol-compare-list">
            {shared.map((row) => (
              <div key={row.name} className="pol-compare-row">
                <p className="pol-compare-entity">
                  <strong>{row.name}</strong>
                  <span className="ai-chip-extra"> · {categoryLabel(row.category)}</span>
                </p>
                <div className="pol-compare-sides">
                  <div>
                    <p className="pol-side-label">{nameA}</p>
                    <CoverageCell side={row.a} />
                  </div>
                  <div>
                    <p className="pol-side-label">{nameB}</p>
                    <CoverageCell side={row.b} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ai-none">No political entity is named in both articles.</p>
        )}

        <dl className="details-list pol-only-list">
          <div>
            <dt>Only in {nameA}</dt>
            <dd>{renderEntityNames(onlyA)}</dd>
          </div>
          <div>
            <dt>Only in {nameB}</dt>
            <dd>{renderEntityNames(onlyB)}</dd>
          </div>
        </dl>
      </>
    )
  }

  return (
    <section className="pol-coverage" aria-labelledby="pol-coverage-title" data-testid="political-coverage">
      <h4 className="rp-title" id="pol-coverage-title">
        Political coverage in these two articles
      </h4>
      <p className="rp-subtitle">
        How each article words the politicians, parties and political organizations it names.
      </p>
      {renderBody()}
      <p className="ad-section-note">
        This compares two articles, not two publishers: one article says nothing about a
        publisher&apos;s politics. The signals are automatic word-list matches and can be wrong.
      </p>
    </section>
  )
}

export default PoliticalCoverageComparison
