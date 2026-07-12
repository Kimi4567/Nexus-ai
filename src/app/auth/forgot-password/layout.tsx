import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot Password — Nexus AI',
  description: 'Reset your Nexus AI password. We will send you a secure link to create a new password.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
