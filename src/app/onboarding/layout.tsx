import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Onboarding — Nexus AI',
  description: 'Complete your Nexus AI onboarding. Set up your brand, connect platforms, and launch your first AI campaign.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
