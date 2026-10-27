// Test setup file for Vitest and React Testing Library
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// The test browser (jsdom) cannot scroll, so make window.scrollTo do nothing
window.scrollTo = () => {}

// Automatically unmount and cleanup DOM after each test
afterEach(() => {
  cleanup()
})
