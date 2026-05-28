import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedPaths = [
  '/studio', '/vex', '/analytics', '/sentinel',
  '/campaigns/new', '/settings', '/dashboard',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  const hasSession = request.cookies.has('sb-access-token') ||
                     request.cookies.has('sb-refresh-token') ||
                     request.cookies.has('next-auth.session-token') ||
                     request.cookies.has('__Secure-next-auth.session-token')
  if (!hasSession) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}