import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Schedule — Nexus AI',
  description: 'Schedule and automate your content publishing across Instagram, TikTok, Facebook, LinkedIn, and YouTube.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
