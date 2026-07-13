import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Try Nexus AI — Instant Demo',
  description: 'Explore a Nexus AI product demonstration covering reviewed strategy, content, campaign planning, and measurement workflows.',
  robots: { index: true, follow: true },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
