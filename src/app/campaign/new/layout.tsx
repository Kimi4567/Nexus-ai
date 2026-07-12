import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Campaign — Nexus AI',
  description: 'Create a new AI-powered marketing campaign. Choose your platforms, goals, and let Nexus AI build your strategy.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
