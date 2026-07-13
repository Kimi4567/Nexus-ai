import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Strategy Studio — Nexus AI',
  description: 'Create a strategy draft grounded in your saved Brand Brain and review it before execution.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
