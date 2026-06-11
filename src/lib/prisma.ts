import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Build a connection URL with `statement_timeout=0` appended.
 *
 * Why: Supabase's connection pooler (PgBouncer) enforces a default statement_timeout
 * (typically 8–30 s). NEXUS campaign generation calls GPT-4o, which can take 30–60 s.
 * When the engine tries to write the result back to the DB, the pooler may have already
 * marked the session as timed-out — causing PostgreSQL error code 57014.
 *
 * Setting statement_timeout=0 disables the per-statement timeout for this client.
 * We rely on Vercel's function timeout (maxDuration) as the outer safety net.
 */
function buildConnectionUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  // Don't add twice
  if (url.includes('statement_timeout')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}statement_timeout=0`
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
    datasourceUrl: buildConnectionUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
