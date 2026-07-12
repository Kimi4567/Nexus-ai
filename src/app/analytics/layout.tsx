import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics — Nexus AI',
  description: 'Campaign performance analytics, engagement metrics, conversion tracking, and AI-suggested optimizations.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
