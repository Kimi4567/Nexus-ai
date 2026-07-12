import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started — Nexus AI',
  description: 'Set your brief, choose your platforms, and NEXUS drafts your first campaign.',
  robots: { index: true, follow: true },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
