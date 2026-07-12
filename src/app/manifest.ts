import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus AI — Your AI Marketing Department',
    short_name: 'Nexus AI',
    description: 'Plan, review, and execute brand-grounded marketing workflows with clear approval gates.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0c0c0a',
    theme_color: '#FF9500',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  }
}
