import React, { useEffect, useMemo, useRef, useState } from 'react'

// Every page the palette can open, with words people might type for it
const PALETTE_PAGES = [
  { tab: 'dashboard', label: 'Dashboard', hint: 'Totals, recent articles, flagged articles', words: 'home overview totals flagged' },
  { tab: 'articles', label: 'Articles', hint: 'Search and read collected articles', words: 'news search read' },
  { tab: 'stories', label: 'Stories & Events', hint: 'News topics, their events and articles', words: 'events timeline group' },
  { tab: 'sources', label: 'Sources', hint: 'Publishers and RSS feeds', words: 'publishers feeds rss' },
  { tab: 'comparisons', label: 'Comparisons', hint: 'Compare coverage across publishers', words: 'compare matching same related different' },
  { tab: 'reports', label: 'Reports', hint: 'Evidence-based reports and downloads', words: 'report download export' },
]

/**
 * CommandPalette Component
 *
 * Ctrl+K (⌘K on a Mac) or the header button opens a box to jump to any page
 * by typing. Arrow keys choose, Enter opens, Escape closes.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onOpen
 * @param {(tab: string) => void} props.onNavigate
 */
export function CommandPalette({ isOpen, onClose, onOpen, onNavigate }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  // Ctrl+K / ⌘K anywhere opens (or closes) the palette
  useEffect(() => {
    function handleKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (isOpen) onClose()
        else onOpen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, onOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  const results = useMemo(() => {
    const words = query.trim().toLowerCase()
    if (!words) return PALETTE_PAGES
    return PALETTE_PAGES.filter((page) =>
      `${page.label} ${page.hint} ${page.words}`.toLowerCase().includes(words)
    )
  }, [query])

  if (!isOpen) return null

  function close() {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }

  function open(page) {
    onNavigate(page.tab)
    close()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(results.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      open(results[activeIndex])
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={close} data-testid="command-palette">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[activeIndex] ? `palette-${results[activeIndex].tab}` : undefined}
            placeholder="Jump to a page…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>
        <ul className="palette-results" id="palette-results" role="listbox" aria-label="Pages">
          {results.length === 0 && <li className="palette-empty">No page matches “{query}”.</li>}
          {results.map((page, index) => (
            <li
              key={page.tab}
              id={`palette-${page.tab}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`palette-item${index === activeIndex ? ' active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => open(page)}
            >
              <span className="palette-item-label">{page.label}</span>
              <span className="palette-item-hint">{page.hint}</span>
            </li>
          ))}
        </ul>
        <p className="palette-footer">
          <kbd className="palette-kbd">↑</kbd> <kbd className="palette-kbd">↓</kbd> to choose ·{' '}
          <kbd className="palette-kbd">Enter</kbd> to open
        </p>
      </div>
    </div>
  )
}

export default CommandPalette
