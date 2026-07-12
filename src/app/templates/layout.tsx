import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Templates — Nexus AI',
  description: 'Browse and use proven marketing campaign templates. Customized by AI for your brand and industry.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
