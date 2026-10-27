import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    // Fixed settings for tests, so they never depend on your own .env file.
    // Page tests use the pretend backend (mock mode); API tests switch to live mode.
    env: {
      VITE_API_BASE_URL: 'http://backend.test',
      VITE_API_PREFIX: '/api',
      VITE_USE_MOCK_DATA: 'true',
    },
  },
})
