import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Password — Nexus AI',
  description: 'Set a new password for your Nexus AI account.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
