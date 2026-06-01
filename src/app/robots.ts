import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/register', '/auth/login', '/privacy', '/terms', '/refund'],
        disallow: [
          '/dashboard/',
          '/settings/',
          '/billing/',
          '/campaigns/',
          '/brand/',
          '/calendar/',
          '/media/',
          '/analytics/',
          '/strategy/',
          '/schedule/',
          '/templates/',
          '/marketing/',
          '/start',
          '/demo',
          '/api/',
          '/onboarding/',
        ],
      },
    ],
    sitemap: 'https://nexus-grow.com/sitemap.xml',
  }
}
