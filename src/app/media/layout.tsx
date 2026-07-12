import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Media Library — Nexus AI',
  description: 'Upload, organize, and manage your marketing assets, images, and creative files.',
  robots: { index: false, follow: false },
}

export { /* @next-codemod-error `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
default } from './page'
