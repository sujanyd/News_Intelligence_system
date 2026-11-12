/**
 * Tests for the StatusBadge component (all its colour variants).
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import StatusBadge from '../components/StatusBadge'

describe('StatusBadge component', () => {
  it('renders completed state with success styling', () => {
    const { container } = render(<StatusBadge variant="completed">Done</StatusBadge>)
    const badge = container.querySelector('.status-badge')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('success')
    expect(badge.textContent).toBe('Done')
  })

  it('renders processing state with info and pulse styling', () => {
    const { container } = render(<StatusBadge variant="processing">Working</StatusBadge>)
    const badge = container.querySelector('.status-badge')
    expect(badge.className).toContain('info')
    expect(badge.className).toContain('processing')
  })

  it('renders pending state with warning styling', () => {
    const { container } = render(<StatusBadge variant="pending">Awaiting</StatusBadge>)
    const badge = container.querySelector('.status-badge')
    expect(badge.className).toContain('warning')
  })

  it('renders failed state with danger styling', () => {
    const { container } = render(<StatusBadge variant="failed">Failed</StatusBadge>)
    const badge = container.querySelector('.status-badge')
    expect(badge.className).toContain('danger')
  })

  it('renders unavailable state with neutral styling', () => {
    const { container } = render(<StatusBadge variant="unavailable">Unavailable</StatusBadge>)
    const badge = container.querySelector('.status-badge')
    expect(badge.className).toContain('neutral')
  })
})
