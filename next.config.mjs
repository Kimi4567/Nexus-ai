import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  // The deterministic Motion Design route uses the packaged FFmpeg binary.
  // Keep it in the traced serverless function instead of relying on a host
  // installation that differs between local, preview, and production.
  outputFileTracingIncludes: {
    '/api/campaigns/[id]/content-plan/[postId]/generate-motion-design': [
      './node_modules/ffmpeg-static/ffmpeg',
    ],
  },
  images: {
    domains: [
      'res.cloudinary.com',
      's3.amazonaws.com',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@radix-ui/react-icons',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // typescript.ignoreBuildErrors removed — build must fail on type errors
  trailingSlash: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

const sentrySourceMapsEnabled = (
  process.env.SENTRY_SOURCE_MAPS_ENABLED === 'true'
  && Boolean(process.env.SENTRY_AUTH_TOKEN)
  && Boolean(process.env.SENTRY_ORG)
  && Boolean(process.env.SENTRY_PROJECT)
)

// Runtime event forwarding and build-time source-map upload are intentionally
// controlled by separate feature gates. This keeps deployments inert until the
// Sentry project, privacy settings, and keys have been verified together.
export default withSentryConfig(nextConfig, {
  org: sentrySourceMapsEnabled ? process.env.SENTRY_ORG : undefined,
  project: sentrySourceMapsEnabled ? process.env.SENTRY_PROJECT : undefined,
  authToken: sentrySourceMapsEnabled ? process.env.SENTRY_AUTH_TOKEN : undefined,
  silent: !sentrySourceMapsEnabled || !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !sentrySourceMapsEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    name: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
    create: sentrySourceMapsEnabled,
    finalize: sentrySourceMapsEnabled,
  },
  widenClientFileUpload: sentrySourceMapsEnabled,
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
      excludeReplayCompressionWorker: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
  },
})
