import type { NextRequest } from 'next/server'

function configuredAppUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  return value && /^https?:\/\//i.test(value) ? value : null
}

/**
 * Production callbacks are pinned to the configured canonical domain. Preview
 * and local checkouts return to the environment that created the session so a
 * Sandbox test can never silently jump into the production application.
 */
export function getRequestBaseUrl(req: NextRequest): string {
  const configured = configuredAppUrl()
  if (process.env.VERCEL_ENV === 'production' && configured) return configured

  const requestLike = req as NextRequest & {
    nextUrl?: { origin?: string }
    url?: string
  }

  const nextOrigin = requestLike.nextUrl?.origin?.replace(/\/$/, '')
  if (nextOrigin && /^https?:\/\//i.test(nextOrigin)) return nextOrigin

  if (typeof requestLike.url === 'string') {
    try {
      const requestOrigin = new URL(requestLike.url).origin.replace(/\/$/, '')
      if (/^https?:\/\//i.test(requestOrigin)) return requestOrigin
    } catch {
      // Fall through to the configured app URL for malformed request mocks.
    }
  }

  return configured ?? 'http://localhost:3000'
}
