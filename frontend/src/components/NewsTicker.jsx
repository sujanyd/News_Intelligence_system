import React from 'react'

/**
 * NewsTicker Component
 *
 * A "Latest" strip that scrolls the newest real headlines, like the ticker
 * under a TV news picture. Each headline opens that article's details.
 *
 * - It pauses while the mouse is over it or a headline has keyboard focus.
 * - With "reduce motion" switched on it does not move; it can be scrolled.
 * - The list is drawn twice so the scrolling loops without a gap; the second
 *   copy is hidden from screen readers and from the Tab key.
 *
 * @param {Object} props
 * @param {Array<{ id: number, title: string, source: string }>} props.items
 * @param {(articleId: number) => void} props.onOpen
 */
export function NewsTicker({ items, onOpen }) {
  if (items.length === 0) return null

  function renderItems(isCopy) {
    return items.map((item) => (
      <li key={`${isCopy ? 'copy' : 'main'}-${item.id}`} className="ticker-item">
        <button
          type="button"
          className="ticker-link"
          onClick={() => onOpen(item.id)}
          tabIndex={isCopy ? -1 : undefined}
        >
          <span className="ticker-source">{item.source}</span> {item.title}
        </button>
      </li>
    ))
  }

  return (
    <div className="ticker" data-testid="news-ticker">
      <span className="ticker-label">Latest</span>
      <div className="ticker-window">
        <div className="ticker-track" style={{ '--ticker-items': items.length }}>
          <ul className="ticker-list" aria-label="Latest headlines">
            {renderItems(false)}
          </ul>
          <ul className="ticker-list" aria-hidden="true">
            {renderItems(true)}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default NewsTicker
