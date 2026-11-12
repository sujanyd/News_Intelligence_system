import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import CountUp from '../components/CountUp'
import CommandPalette from '../components/CommandPalette'
import MetricCard from '../components/MetricCard'
import App from '../App'

describe('CountUp', () => {
  it('shows the final value at once when the browser cannot animate', () => {
    // jsdom has no matchMedia, like a browser with animations unavailable
    render(<CountUp value="66 / 84" />)
    expect(screen.getAllByText('66 / 84')).toHaveLength(2) // visible copy and screen-reader copy
  })

  it('shows text that is not a number as it is', () => {
    render(<CountUp value="--" />)
    expect(screen.getAllByText('--')).toHaveLength(2)
  })
})

describe('MetricCard', () => {
  it('shows a loading placeholder instead of a number while loading', () => {
    render(<MetricCard title="Total articles" value="84" isLoading />)
    expect(screen.getByLabelText('Loading')).toBeDefined()
    expect(screen.queryByText('84')).toBeNull()
    expect(screen.getByText('Loading', { selector: '.status-badge' })).toBeDefined()
  })

  it('needs no label for live data, and says "Not available" otherwise', () => {
    const { rerender } = render(<MetricCard title="Reports" value="3" isPlaceholder={false} />)
    expect(screen.queryByText('Live')).toBeNull()
    rerender(<MetricCard title="Reports" value="--" isPlaceholder />)
    expect(screen.getByText('Not available')).toBeDefined()
  })
})

describe('CommandPalette', () => {
  function renderPalette(isOpen = true) {
    const props = { onClose: vi.fn(), onOpen: vi.fn(), onNavigate: vi.fn() }
    render(<CommandPalette isOpen={isOpen} {...props} />)
    return props
  }

  it('opens with Ctrl+K', () => {
    const props = renderPalette(false)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(props.onOpen).toHaveBeenCalled()
  })

  it('filters pages and opens the chosen one with Enter', () => {
    const props = renderPalette()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'download' } })
    const options = within(screen.getByRole('listbox', { name: 'Pages' })).getAllByRole('option')
    expect(options.map((option) => option.querySelector('.palette-item-label').textContent)).toEqual(['Reports'])
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onNavigate).toHaveBeenCalledWith('reports')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('moves with the arrow keys and closes with Escape', () => {
    const props = renderPalette()
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Articles/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('says when nothing matches', () => {
    renderPalette()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No page matches “zzz”.')).toBeDefined()
  })
})

describe('App quick jump', () => {
  it('opens the palette from the header and jumps to a page', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to a page (Ctrl+K)' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sources' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(screen.getByRole('heading', { level: 1, name: 'News Sources' })).toBeDefined()
    expect(screen.queryByTestId('command-palette')).toBeNull()
  })
})

describe('Stamp', () => {
  it('reads as one label for screen readers', async () => {
    const { default: Stamp } = await import('../components/Stamp')
    render(<Stamp label="Filed" detail="5 Nov 2026, 2:37" />)
    expect(screen.getByRole('img', { name: 'Filed, 5 Nov 2026, 2:37' })).toBeDefined()
  })
})

describe('LoadingState teletype', () => {
  it('keeps the whole message in the page and tells the CSS how long it is', async () => {
    const { default: LoadingState } = await import('../components/LoadingState')
    render(<LoadingState message="Loading stories..." />)
    const message = screen.getByText('Loading stories...')
    expect(message.style.getPropertyValue('--chars')).toBe('18')
    expect(screen.getByRole('status')).toBeDefined()
  })
})
