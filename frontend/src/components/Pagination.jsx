import React from 'react'

/**
 * Reusable Pagination Component
 *
 * "Previous" and "Next" buttons with the current page number.
 * Shows nothing when there is only one page.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Page being shown (starts at 1)
 * @param {boolean} props.hasNextPage - Is there a page after this one?
 * @param {number | null} [props.totalPages] - Total pages, if the backend told us
 * @param {(page: number) => void} props.onPageChange - Called with the new page number
 */
export function Pagination({ currentPage, hasNextPage, totalPages = null, onPageChange }) {
  if (currentPage === 1 && !hasNextPage) {
    return null
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span className="pagination-info">
        Page {currentPage}
        {totalPages !== null && ` of ${totalPages}`}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
      >
        Next
      </button>
    </nav>
  )
}

export default Pagination
