import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Minimal Vitest setup — smoke tests for critical money/credit paths only.
// Not a full test framework; see src/lib/__tests__/credits.test.ts.
export default defineConfig({
  // Use the automatic JSX runtime (matches Next.js) so component tests don't
  // need an explicit React import.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    // Default environment is node; component tests opt into jsdom per-file
    // via a `// @vitest-environment jsdom` directive.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
