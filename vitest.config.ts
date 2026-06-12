import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Minimal Vitest setup — smoke tests for critical money/credit paths only.
// Not a full test framework; see src/lib/__tests__/credits.test.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
