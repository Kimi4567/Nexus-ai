import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Content Calendar — Nexus AI',
  description: 'Review saved content drafts, schedules, and verified publishing records across supported channels.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
