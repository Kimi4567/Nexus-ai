import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Imports — Nexus AI',
  description: 'Import existing marketing assets, campaigns, and data into Nexus AI for seamless AI-powered management.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
