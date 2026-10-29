import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import IngestionPanel from '../components/IngestionPanel'
import { INGESTION_AVAILABLE } from '../api/newsApi'

describe('IngestionPanel', () => {
  it('is disabled and says why when collection is not available', () => {
    render(<IngestionPanel isAvailable={false} unavailableReason="Turned off in mock mode." onRun={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Run News Collection' }).disabled).toBe(true)
    expect(screen.getByText('Not available')).toBeDefined()
    expect(screen.getByText('Turned off in mock mode.')).toBeDefined()
  })

  it('is enabled when the endpoint is available', () => {
    render(<IngestionPanel isAvailable={true} onRun={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Run News Collection' }).disabled).toBe(false)
  })

  it('is turned off in mock mode, so sample data never hides a real run', () => {
    // Tests run with VITE_USE_MOCK_DATA=true
    expect(INGESTION_AVAILABLE).toBe(false)
  })
})
