import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing & Plans — Nexus AI',
  description: 'Manage your subscription, AI credits, and billing history. Compare the Growth and Autopilot plans.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
