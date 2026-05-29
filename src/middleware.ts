import { NextRequest, NextResponse } from 'next/server'

// Protected routes — require authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/campaigns',
  '/campaign',
  '/strategy',
  '/brand',
  '/analytics',
  '/settings',
  '/billing',
  '/studio',
  '/sentinel',
  '/schedule',
  '/calendar',
  '/media',
  '/imports',
  '/templates',
  '/agency',
  '/workspace',
  '/onboarding',
  '/vex',
]

// Public routes — always accessible
const PUBLIC_PREFIXES = [
  '/auth',
  '/api',
  '/share',
  '/demo',
  '/_next',
  '/favicon',
  '/robots',
  '/sitemap',
]

function isProtected(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return false
  if (pathname === '/') return false
  if (pathname === '/start') return false
  if (pathname === '/privacy') return false
  if (pathname === '/terms') return false
  if (pathname === '/cookies') return false
  if (pathname === '/refund') return false
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!isProtected(pathname)) {
    return NextResponse.next()
  }

  // Check for Supabase session cookie
  // Supabase stores session as sb-<project>-auth-token
  const hasCookie = [...req.cookies.getAll()].some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  // Also check Authorization header (for API calls from mobile/external)
  const hasAuthHeader = req.headers.get('authorization')?.startsWith('Bearer ')

  if (!hasCookie && !hasAuthHeader) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
