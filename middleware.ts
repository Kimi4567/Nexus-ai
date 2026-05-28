import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth-protected routes
const PROTECTED_ROUTES = [
  '/dashboard',
  '/studio',
  '/vex',
  '/analytics',
  '/sentinel',
  '/campaigns',
  '/settings',
  '/billing',
  '/brand',
  '/calendar',
  '/workspace',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`),
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  // Check for auth cookies (Supabase or NextAuth)
  const hasSupabaseAuth =
    request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-refresh-token')
  const hasNextAuth = request.cookies.has('next-auth.session-token')

  const isAuthenticated = hasSupabaseAuth || hasNextAuth

  if (!isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|auth).*)',
  ],
}
