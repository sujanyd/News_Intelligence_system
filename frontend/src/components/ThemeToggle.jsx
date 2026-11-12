import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'news-intelligence-theme'

// The theme the user picked earlier, or null (then the computer's setting is used)
function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage can be blocked (private window); the button still works
  }
}

function systemTheme() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

/**
 * ThemeToggle Component
 *
 * Switches between the dark and the light theme. Until the user presses it,
 * the app follows the computer's setting (prefers-color-scheme in index.css).
 * The choice is kept in this browser (localStorage) and set as
 * <html data-theme="light|dark">.
 */
export function ThemeToggle() {
  const [storedTheme, setStoredTheme] = useState(readStoredTheme)
  const theme = storedTheme || systemTheme()

  // Only a picked theme is written on <html>; otherwise the CSS follows the computer
  useEffect(() => {
    if (storedTheme) document.documentElement.dataset.theme = storedTheme
    else delete document.documentElement.dataset.theme
  }, [storedTheme])

  function handleClick() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    // Where the browser supports it, the new edition rolls over the old one
    // like a press roller (see ::view-transition in refresh.css)
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition === 'function' && !reduceMotion) {
      document.startViewTransition(() => {
        document.documentElement.dataset.theme = nextTheme
        setStoredTheme(nextTheme)
      })
    } else {
      setStoredTheme(nextTheme)
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // Not saved, but the theme still changes for this visit
    }
  }

  const nextLabel = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="btn btn-secondary theme-toggle"
      onClick={handleClick}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="theme-toggle-text">{theme === 'dark' ? 'Day edition' : 'Night edition'}</span>
    </button>
  )
}

export default ThemeToggle
