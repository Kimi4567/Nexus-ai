import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account — Nexus AI',
  description: 'Create your NEXUS AI account. Get 12 one-time trial credits and start planning your marketing today.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
