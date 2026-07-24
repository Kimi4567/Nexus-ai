const SERVERLESS_CONNECTION_LIMIT = '1'
const SERVERLESS_POOL_TIMEOUT_SECONDS = '10'

function stripUnsupportedStatementTimeout(url: string): string {
  return url
    .replace(/&statement_timeout=[^&]*/g, '')
    .replace(/\?statement_timeout=[^&]*&/, '?')
    .replace(/\?statement_timeout=[^&]*$/, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')
}

/**
 * Keep every Vercel function on a deliberately small Prisma client pool.
 *
 * Supabase's transaction pooler limits client connections independently from
 * Postgres backend connections. A default Prisma pool per warm function can
 * exhaust that client limit during a burst even when Postgres itself is mostly
 * idle. Explicit operator values remain authoritative.
 */
export function buildPrismaConnectionUrl(
  rawUrl = process.env.DATABASE_URL,
  isServerless = process.env.VERCEL === '1',
): string | undefined {
  if (!rawUrl) return undefined

  const clean = stripUnsupportedStatementTimeout(rawUrl)
  if (!isServerless) return clean

  try {
    const url = new URL(clean)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', SERVERLESS_CONNECTION_LIMIT)
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', SERVERLESS_POOL_TIMEOUT_SECONDS)
    }
    return url.toString()
  } catch {
    // Do not guess how to mutate an invalid or non-standard operator value.
    // Prisma will return the actionable configuration error at startup.
    return clean
  }
}
