import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — Nexus AI',
  description: 'Sign in to your Nexus AI dashboard. Access your AI marketing campaigns, content calendar, and analytics.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
