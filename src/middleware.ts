import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public-only routes (redirect to dashboard if already logged in)
const PUBLIC_ONLY = ['/auth/login', '/auth/register', '/auth/forgot-password']

// API routes — never block
const API_PREFIX = '/api'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Never touch API routes
  if (pathname.startsWith(API_PREFIX)) return NextResponse.next()

  // Redirect logged-in users away from auth pages
  // We check for Supabase cookie OR next-auth token
  const hasCookie = [...request.cookies.getAll()].some(
    c => (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) ||
         c.name === 'next-auth.session-token'
  )

  const isPublicOnly = PUBLIC_ONLY.some(p => pathname.startsWith(p))

  // If authenticated and on auth page → go to dashboard
  if (hasCookie && isPublicOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow everything else — client-side auth handles protection
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|.*\\..*).*)'],
}
