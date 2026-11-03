import React from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import ArticleMatchingSection from '../components/ArticleMatchingSection'

/**
 * Comparisons Page
 *
 * Primary interface for reviewing article matching pairs and classifications:
 * - Displays matched article pairs with SAME, RELATED, and DIFFERENT labels.
 * - Allows side-by-side inspection of paired articles.
 * - Explains similarity metrics and classification confidence separately.
 * - Supports review actions and read-only mode according to backend capabilities.
 */
export function Comparisons() {
  return (
    <div className="page-comparisons" data-testid="page-comparisons">
      <PageHeader
        title="Comparisons"
        description="Review pairwise semantic matches, compare coverage side-by-side, and inspect SAME, RELATED, or DIFFERENT event classifications."
        badge={<StatusBadge variant="primary">Pairwise Matching</StatusBadge>}
      />

      <ArticleMatchingSection
        title="Pairwise Matching & Classification Results"
      />
    </div>
  )
}

export default Comparisons
