// Test setup file for Vitest and React Testing Library
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Automatically unmount and cleanup DOM after each test
afterEach(() => {
  cleanup()
})
