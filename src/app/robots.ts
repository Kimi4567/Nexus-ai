import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/start', '/demo', '/privacy', '/terms'],
      disallow: [
        '/dashboard',
        '/settings',
        '/billing',
        '/campaigns',
        '/brand',
        '/calendar',
        '/media',
        '/analytics',
        '/strategy',
        '/schedule',
        '/templates',
        '/imports',
        '/agency',
        '/workspace',
        '/campaign',
        '/project',
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
        '/api/',
        '/share/',
      ],
    },
    sitemap: 'https://nexus-grow.com/sitemap.xml',
  }
}
