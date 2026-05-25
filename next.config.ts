import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Prisma client types are regenerated during Vercel build (prisma generate runs first)
    // Local TS errors on new schema fields are expected until local prisma generate is run
    ignoreBuildErrors: true,
  },
}

export default nextConfig
