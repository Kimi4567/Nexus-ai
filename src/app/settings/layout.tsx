import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings — Nexus AI',
  description: 'Configure your account, preferences, notifications, and workspace settings.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
