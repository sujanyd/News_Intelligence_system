import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import IngestionPanel from '../components/IngestionPanel'
import { INGESTION_AVAILABLE } from '../api/newsApi'

describe('IngestionPanel', () => {
  it('is disabled and says why when the backend has no collection endpoint', () => {
    render(<IngestionPanel isAvailable={false} onRun={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Run News Collection' }).disabled).toBe(true)
    expect(screen.getByText('Waiting for backend')).toBeDefined()
    expect(screen.getByText(/backend does not have a news collection endpoint/)).toBeDefined()
  })

  it('is enabled when the endpoint is available', () => {
    render(<IngestionPanel isAvailable={true} onRun={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Run News Collection' }).disabled).toBe(false)
  })

  it('matches the real backend today: no collection endpoint yet', () => {
    expect(INGESTION_AVAILABLE).toBe(false)
  })
})
