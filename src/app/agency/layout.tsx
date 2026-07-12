import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agency Hub — Nexus AI',
  description: 'Multi-client agency dashboard. Manage multiple brands, campaigns, and client reports from one unified workspace.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
