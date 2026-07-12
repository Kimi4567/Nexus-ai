import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Try Nexus AI — Instant Demo',
  description: 'Experience Nexus AI instantly. See how our AI marketing team generates campaigns, content, and strategy in real-time.',
  robots: { index: true, follow: true },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
