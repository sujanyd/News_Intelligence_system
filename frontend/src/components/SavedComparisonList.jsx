import React, { useEffect, useState } from 'react'
import Card from './Card'
import DataTable from './DataTable'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import { COMPARISONS_AVAILABLE, fetchAllComparisons } from '../api/newsApi'
import { formatDate } from '../utils/formatDate'

/**
 * SavedComparisonList Component
 *
 * The comparisons saved in the backend (GET /comparisons, all pages).
 *
 * @param {Object} props
 * @param {(comparisonId: number) => void} props.onOpen
 */
export function SavedComparisonList({ onOpen }) {
  const [comparisons, setComparisons] = useState([])
  const [isLoading, setIsLoading] = useState(COMPARISONS_AVAILABLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!COMPARISONS_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchAllComparisons()
      .then(({ items }) => {
        if (isCurrentRequest) setComparisons(items)
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

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setReloadCount(reloadCount + 1)
  }

  const columns = [
    { key: 'title', label: 'Comparison', render: (comparison) => <strong>{comparison.title}</strong> },
    { key: 'articles', label: 'Articles', render: (comparison) => comparison.article_count },
    { key: 'status', label: 'Status', render: (comparison) => comparison.status || 'Not given' },
    { key: 'created', label: 'Saved', render: (comparison) => formatDate(comparison.created_at) },
    {
      key: 'open',
      label: 'Open',
      render: (comparison) => (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpen(comparison.id)}
          aria-label={`Open comparison ${comparison.id}: ${comparison.title}`}
        >
          Open
        </button>
      ),
    },
  ]

  function renderBody() {
    if (!COMPARISONS_AVAILABLE) {
      return (
        <AlertMessage
          type="info"
          title="Saved comparisons need the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server."
        />
      )
    }
    if (isLoading) return <LoadingState message="Loading saved comparisons..." />
    if (errorMessage) {
      return (
        <AlertMessage type="error" title="Could not load the saved comparisons." message={errorMessage} onRetry={handleRetry} />
      )
    }
    if (comparisons.length === 0) {
      return (
        <EmptyState
          title="No saved comparisons yet"
          description='Choose a story below and press "Save these two as a comparison".'
        />
      )
    }
    return <DataTable columns={columns} rows={comparisons} caption="Saved comparisons" />
  }

  return (
    <Card
      title="Saved comparisons"
      subtitle={isLoading || errorMessage || !COMPARISONS_AVAILABLE ? undefined : `${comparisons.length} saved`}
    >
      {renderBody()}
    </Card>
  )
}

export default SavedComparisonList
