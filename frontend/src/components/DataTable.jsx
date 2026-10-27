import React from 'react'

/**
 * Reusable DataTable Component
 *
 * Draws a table from a list of columns and a list of rows.
 * On small phone screens the CSS turns each row into a card, using the
 * "data-label" on each cell as the heading.
 *
 * Example:
 *   columns = [{ key: 'name', label: 'Name' }]
 *   rows    = [{ id: 1, name: 'Daily Ledger' }]
 *
 * @param {Object} props
 * @param {Array<{ key: string, label: string, render?: (row: Object) => React.ReactNode }>} props.columns
 *   Each column. "render" is optional and lets a column show something custom.
 * @param {Array<Object>} props.rows - The data. Every row needs a unique "id".
 * @param {string} props.caption - Short description of the table for screen readers
 */
export function DataTable({ columns, rows, caption }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
