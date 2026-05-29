import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus AI — Your AI Marketing Department',
    short_name: 'Nexus AI',
    description: 'Generate complete marketing campaigns in 60 seconds — strategy, hooks, scripts, captions, and 30-day content calendar.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0c0c0a',
    theme_color: '#FF9500',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
