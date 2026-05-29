import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = [
  '/dashboard',
  '/settings',
  '/billing',
  '/campaigns',
  '/brand',
  '/calendar',
  '/media',
  '/analytics',
  '/strategy',
  '/schedule',
  '/templates',
  '/imports',
  '/agency',
  '/workspace',
  '/campaign',
  '/project',
  '/studio',
  '/sentinel',
  '/vex',
  '/onboarding',
]

const PUBLIC_ONLY = ['/auth/login', '/auth/register', '/auth/forgot-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isPublicOnly = PUBLIC_ONLY.some(p => pathname.startsWith(p))

  // Check auth via Supabase cookie or NextAuth session
  const supabaseToken = [...request.cookies.getAll()].find(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  const nextAuthToken = request.cookies.get('next-auth.session-token')?.value
  const isAuthenticated = !!(supabaseToken || nextAuthToken)

  // Redirect unauthenticated users from protected routes
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isPublicOnly && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets|.*\\..*).*)'],
}
