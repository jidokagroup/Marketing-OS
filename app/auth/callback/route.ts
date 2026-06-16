import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

/**
 * GET /auth/callback
 * Handles OAuth redirect and email confirmation from Supabase Auth.
 * Exchanges the auth code for a session, then:
 *  - New users (no brand profile) → /onboarding
 *  - Returning users → next param or /dashboard
 *
 * IMPORTANT: We manually copy session cookies onto the redirect response.
 * If we used cookieStore.set() and returned NextResponse.redirect() separately,
 * the cookies would be on different response objects and the browser would never
 * receive the session — leaving the user unauthenticated after the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()

    // Collect cookies Supabase wants to set so we can attach them to the redirect
    const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options: options ?? {} })
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      let redirectPath = next

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: brand } = await supabase
          .from('brand_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!brand) {
          redirectPath = '/onboarding'
        }
      }

      // Build the redirect and attach session cookies so the browser receives them
      const response = NextResponse.redirect(`${origin}${redirectPath}`)
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set({ name, value, ...options })
      })
      return response
    }

    console.error('Auth code exchange error:', error)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
