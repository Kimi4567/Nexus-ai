import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Strip `statement_timeout` from the DATABASE_URL before passing to Prisma.
 *
 * Why: Supabase's PgBouncer (port 6543, transaction mode) does NOT support
 * arbitrary startup options like statement_timeout in the connection URL.
 * Passing it causes PgBouncer to reject the connection entirely, which makes
 * every Prisma query silently fail (credits = 0, role = USER, etc.)
 *
 * Long-running routes (campaign generation, scan-website) are protected by
 * maxDuration in vercel.json — we don't need statement_timeout here.
 */
function buildConnectionUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  // Remove statement_timeout=<value> from the URL query string
  const clean = url
    .replace(/&statement_timeout=[^&]*/g, '')   // &statement_timeout=0
    .replace(/\?statement_timeout=[^&]*&/, '?') // ?statement_timeout=0&rest → ?rest
    .replace(/\?statement_timeout=[^&]*$/, '')  // ?statement_timeout=0 (only param)
    .replace(/\?&/, '?')                        // clean up ?& edge case
    .replace(/[?&]$/, '')                       // remove trailing ? or &

  return clean
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
    datasourceUrl: buildConnectionUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
