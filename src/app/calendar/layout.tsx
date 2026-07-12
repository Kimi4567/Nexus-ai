import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Content Calendar — Nexus AI',
  description: 'View your AI-planned 30-day content calendar across all platforms. Schedule, edit, and publish posts.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
