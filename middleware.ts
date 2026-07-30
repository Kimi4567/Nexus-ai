import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPublicOnlyAuthPage, isPublicPage } from '@/lib/authRoutePolicy'

const PRIVATE_AUTH_CACHE = 'private, no-store'

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach(cookie => target.cookies.set(cookie))
  target.headers.set('Cache-Control', PRIVATE_AUTH_CACHE)
  return target
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publicPage = isPublicPage(pathname)
  const publicOnlyAuthPage = isPublicOnlyAuthPage(pathname)

  // Public marketing/customer journeys do not need a session refresh. The three
  // sign-in entry screens are the exception so authenticated users can be sent
  // directly back to their workspace.
  if (publicPage && !publicOnlyAuthPage) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    if (publicPage) return NextResponse.next()
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: { name: 'nexus-auth-token' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // getClaims verifies the JWT instead of trusting cookie presence. It also
  // allows Supabase SSR to refresh an expired session through setAll above.
  const { data, error } = await supabase.auth.getClaims()
  const authenticated = !error && Boolean(data?.claims?.sub)

  if (publicOnlyAuthPage && authenticated) {
    return copyCookies(response, NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  if (!publicPage && !authenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    return copyCookies(response, NextResponse.redirect(loginUrl))
  }

  response.headers.set('Cache-Control', PRIVATE_AUTH_CACHE)
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\..*).*)',
  ],
}
