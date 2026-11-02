/**
 * Tests for Article Processing Status UI Components
 *
 * Covers:
 *   - StatusBadge (completed, processing, pending, failed, unavailable)
 *   - ProcessingStep (rendering, markers, details, error handling)
 *   - ProcessingStatusPanel (all states: completed, pending, processing, failed, unavailable, retry)
 *   - Honest backend state handling: no fake completion data, blocked matching on failure
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import StatusBadge from '../components/StatusBadge'
import ProcessingStep from '../components/ProcessingStep'
import ProcessingStatusPanel from '../components/ProcessingStatusPanel'

const MOCK_ARTICLE = {
  id: 101,
  title: 'City council approves new budget for public transport',
  source_id: 1,
  source_name: 'Daily Ledger',
  url: 'https://dailyledger.example/news/transport-budget',
  published_at: '2026-10-26T08:30:00Z',
  retrieved_at: '2026-10-26T09:00:00Z',
  content_availability: 'full_text',
  content: 'The city council voted on Monday to approve a larger budget for buses and trains.',
}

const MOCK_EMBEDDINGS_SUCCESS = [
  {
    article_id: 101,
    embedding_type: 'headline',
    status: 'generated',
    model_name: 'all-MiniLM-L6-v2',
    vector_reference: 'art_101_headline_vec',
    dimensions: 384,
    error: null,
  },
  {
    article_id: 101,
    embedding_type: 'body',
    status: 'generated',
    model_name: 'all-MiniLM-L6-v2',
    vector_reference: 'art_101_body_vec',
    dimensions: 384,
    error: null,
  },
]

const MOCK_EMBEDDINGS_FAILED = [
  {
    article_id: 101,
    embedding_type: 'body',
    status: 'error',
    model_name: 'all-MiniLM-L6-v2',
    vector_reference: null,
    dimensions: null,
    error: 'Text content too brief for vector embedding generation.',
  },
]

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

describe('ProcessingStep component', () => {
  it('renders title, description, and status badge', () => {
    render(
      <ProcessingStep
        stepNumber={1}
        title="Article Collection"
        status="completed"
        description="Collected and stored."
      />
    )

    expect(screen.getByText('Article Collection')).toBeDefined()
    expect(screen.getByText('Collected and stored.')).toBeDefined()
    expect(screen.getByText('Completed')).toBeDefined()
    expect(screen.getByText('✓')).toBeDefined()
  })

  it('renders custom badgeLabel when provided', () => {
    render(
      <ProcessingStep
        stepNumber={2}
        title="Text Preprocessing"
        status="unavailable"
        badgeLabel="Integration Pending"
        description="In-memory normalization."
      />
    )

    expect(screen.getByText('Integration Pending')).toBeDefined()
  })

  it('renders non-technical user-facing error message', () => {
    render(
      <ProcessingStep
        stepNumber={3}
        title="Vector Embeddings"
        status="failed"
        description="Vector generation failed."
        error="Article content too short to create a reliable vector embedding."
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(within(alert).getByText('Article content too short to create a reliable vector embedding.')).toBeDefined()
    expect(screen.getByText('✕')).toBeDefined()
  })

  it('renders extra details node when passed', () => {
    render(
      <ProcessingStep
        stepNumber={1}
        title="Collection"
        status="completed"
        details={<span data-testid="test-details">Source: Daily Ledger</span>}
      />
    )

    expect(screen.getByTestId('test-details')).toBeDefined()
    expect(screen.getByText('Source: Daily Ledger')).toBeDefined()
  })
})

describe('ProcessingStatusPanel component', () => {
  it('renders COMPLETED state when vector embeddings exist', () => {
    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={MOCK_EMBEDDINGS_SUCCESS}
        isLoadingEmbeddings={false}
      />
    )

    // Panel is present
    expect(screen.getByTestId('processing-status-panel')).toBeDefined()

    // Overall header badge
    expect(screen.getByText('Embeddings Generated')).toBeDefined()

    // Step 1: Collection is completed
    const step1 = screen.getByTestId('step-collection')
    expect(within(step1).getByText('Article Collection')).toBeDefined()
    expect(within(step1).getByText('Completed')).toBeDefined()
    expect(within(step1).getByText('Full text')).toBeDefined()

    // Step 2: Preprocessing is honestly marked Integration Pending
    const step2 = screen.getByTestId('step-preprocessing')
    expect(within(step2).getByText('Integration Pending')).toBeDefined()

    // Step 3: Embeddings is marked Generated with chip details
    const step3 = screen.getByTestId('step-embeddings')
    expect(within(step3).getByText('Generated')).toBeDefined()
    expect(within(step3).getByText('headline')).toBeDefined()
    expect(within(step3).getByText('body')).toBeDefined()
    expect(within(step3).getAllByText('384d').length).toBe(2)

    // Step 4: Story Matching is marked Integration Pending (not claiming ready without endpoint)
    const step4 = screen.getByTestId('step-matching')
    expect(within(step4).getByText('Integration Pending')).toBeDefined()

    // Step 5: AI Framing & Bias Analysis is marked Integration Pending
    const step5 = screen.getByTestId('step-analysis')
    expect(within(step5).getByText('Integration Pending')).toBeDefined()
  })

  it('renders PENDING state when no embeddings have been generated yet', () => {
    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={[]}
        isLoadingEmbeddings={false}
      />
    )

    // Overall header shows embeddings pending
    expect(screen.getByText('Collected — Embeddings Pending')).toBeDefined()

    // Step 3 shows pending
    const step3 = screen.getByTestId('step-embeddings')
    expect(within(step3).getByText('Pending')).toBeDefined()

    // Step 4 indicates matching is awaiting embeddings
    const step4 = screen.getByTestId('step-matching')
    expect(within(step4).getByText('Awaiting Embeddings')).toBeDefined()
    expect(within(step4).getByText(/Matching is pending/)).toBeDefined()
  })

  it('renders PROCESSING state when embeddings are actively loading', () => {
    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={[]}
        isLoadingEmbeddings={true}
      />
    )

    expect(screen.getByText('Checking Processing Status…')).toBeDefined()

    const step3 = screen.getByTestId('step-embeddings')
    expect(within(step3).getByText('Checking…')).toBeDefined()
  })

  it('renders FAILED state and blocks matching when an embedding has an error', () => {
    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={MOCK_EMBEDDINGS_FAILED}
        isLoadingEmbeddings={false}
      />
    )

    // Overall header
    expect(screen.getByText('Processing Issue Detected')).toBeDefined()

    // Step 3 shows failed with error
    const step3 = screen.getByTestId('step-embeddings')
    expect(within(step3).getByText('Failed')).toBeDefined()
    expect(within(step3).getByText('Text content too brief for vector embedding generation.')).toBeDefined()

    // Step 4 is BLOCKED and explicitly DOES NOT claim ready for matching
    const step4 = screen.getByTestId('step-matching')
    expect(within(step4).getByText('Blocked')).toBeDefined()
    expect(within(step4).getByText(/Matching is blocked: Vector embeddings failed generation/)).toBeDefined()
  })

  it('renders UNAVAILABLE state with retry button when embedding check fails', () => {
    const handleRetry = vi.fn()

    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={[]}
        isLoadingEmbeddings={false}
        embeddingsError="Connection timed out"
        onRetryEmbeddings={handleRetry}
      />
    )

    expect(screen.getByText('Status Check Unavailable')).toBeDefined()
    expect(screen.getByText('Could not check embedding records.')).toBeDefined()

    const retryBtn = screen.getByRole('button', { name: 'Retry Check' })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('never displays fake AI analysis completion data', () => {
    render(
      <ProcessingStatusPanel
        article={MOCK_ARTICLE}
        embeddings={MOCK_EMBEDDINGS_SUCCESS}
      />
    )

    const step5 = screen.getByTestId('step-analysis')
    expect(within(step5).queryByText('Completed')).toBeNull()
    expect(within(step5).getByText('Integration Pending')).toBeDefined()
    expect(within(step5).getByText(/Awaiting AI analysis service integration/)).toBeDefined()
  })
})
