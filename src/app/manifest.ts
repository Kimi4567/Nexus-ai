import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus AI — Your AI Marketing Department',
    short_name: 'Nexus AI',
    description: 'Build reviewed marketing strategy, hooks, scripts, captions, and a first-30-day content direction plan from one Brand Brain.',
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
