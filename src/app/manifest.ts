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
        src: '/nexus_ai_icon.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
      {
        src: '/nexus_ai_icon_large.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
      {
        src: '/nexus_ai_icon.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
