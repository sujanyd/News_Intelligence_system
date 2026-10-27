import React from 'react'

/**
 * Reusable Pagination Component
 *
 * "Previous" and "Next" buttons with the current page number.
 * Shows nothing when everything fits on one page.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Page being shown (starts at 1)
 * @param {number} props.totalPages - How many pages there are
 * @param {(page: number) => void} props.onPageChange - Called with the new page number
 */
export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) {
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
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </nav>
  )
}

export default Pagination
