import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const protectedPaths = [
  '/dashboard',
  '/inbox',
  '/settings',
  '/analytics',
  '/scheduler',
  '/onboarding',
  '/brand-setup',
  '/account',
  '/help',
  '/waitlist-access',
  '/blog-admin',
  '/collab-admin',
  '/collab-dashboard',
  '/admin-access',
]

const authPaths = ['/login', '/signup']

// Marketing pages that should redirect logged-in users to the dashboard
const marketingPaths = ['/', '/index.html']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage = authPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const isMarketingRoot = marketingPaths.includes(pathname)

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth/marketing pages to the dashboard
  if ((isAuthPage || isMarketingRoot) && user) {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    dashUrl.search = ''
    return NextResponse.redirect(dashUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
