const PUBLIC_EXACT_ROUTES = new Set([
  '/',
])

const PUBLIC_ROUTE_PREFIXES = [
  '/auth',
  '/privacy',
  '/terms',
  '/cookies',
  '/refund',
  '/unsubscribe',
  '/lead-form',
  '/lp',
  '/share',
  '/data-deletion',
  '/meta-review-demo',
  '/meta-ads-review-demo',
  '/tiktok-review-demo',
] as const

const PUBLIC_ONLY_AUTH_ROUTES = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
])

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPublicPage(pathname: string): boolean {
  if (PUBLIC_EXACT_ROUTES.has(pathname)) return true
  return PUBLIC_ROUTE_PREFIXES.some(prefix => matchesRoutePrefix(pathname, prefix))
}

export function isPublicOnlyAuthPage(pathname: string): boolean {
  return PUBLIC_ONLY_AUTH_ROUTES.has(pathname)
}
