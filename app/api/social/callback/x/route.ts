import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const X_CLIENT_ID = process.env.X_CLIENT_ID ?? ''
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.autom8ig.io'
const REDIRECT_URI = `${APP_URL}/api/social/callback/x`

// GET /api/social/callback/x — handle X OAuth 2.0 PKCE callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(new URL(`/dashboard?social_error=${encodeURIComponent(errorParam)}`, APP_URL))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?social_error=missing_params', APP_URL))
  }

  // Read PKCE cookie
  const cookieStore = await cookies()
  const pkceRaw = cookieStore.get('x_pkce')?.value
  if (!pkceRaw) {
    return NextResponse.redirect(new URL('/dashboard?social_error=session_expired', APP_URL))
  }

  let pkce: { codeVerifier: string; state: string; userId: string }
  try {
    pkce = JSON.parse(pkceRaw)
  } catch {
    return NextResponse.redirect(new URL('/dashboard?social_error=invalid_session', APP_URL))
  }

  // Validate state to prevent CSRF
  if (pkce.state !== state) {
    return NextResponse.redirect(new URL('/dashboard?social_error=state_mismatch', APP_URL))
  }

  // Clear the PKCE cookie
  cookieStore.delete('x_pkce')

  // Get userId from session (more authoritative than cookie)
  const sessionSupabase = await createClient()
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()
  const userId = sessionUser?.id ?? pkce.userId

  try {
    // 1. Exchange code for tokens
    const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pkce.codeVerifier,
      }),
    })

    const tokenData = await tokenRes.json()
    console.log('[x-callback] token response:', JSON.stringify(tokenData).slice(0, 200))

    if (!tokenData.access_token) {
      throw new Error(`No access token: ${JSON.stringify(tokenData)}`)
    }

    const accessToken: string = tokenData.access_token
    const refreshToken: string | null = tokenData.refresh_token ?? null

    // 2. Fetch X user profile
    const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    const userData = await userRes.json()
    const xUser = userData.data ?? {}
    console.log('[x-callback] x user:', xUser.username ?? 'unknown')

    // 3. Store in Supabase social_accounts
    const svc = createServiceClient()

    const { data: existing } = await svc
      .from('social_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'x')
      .maybeSingle()

    // Store access_token; append refresh_token with separator so we can split later
    const tokenPayload = refreshToken
      ? `${accessToken}||${refreshToken}`
      : accessToken

    const payload = {
      user_id: userId,
      platform: 'x' as const,
      external_account_id: xUser.id ?? null,
      page_token_encrypted: tokenPayload,
      username: xUser.username ?? null,
      profile_picture_url: xUser.profile_image_url ?? null,
      connected_at: new Date().toISOString(),
      status: 'active',
    }

    const { error: upsertError } = existing
      ? await svc.from('social_accounts').update(payload).eq('id', existing.id)
      : await svc.from('social_accounts').insert(payload)

    if (upsertError) {
      console.error('[x-callback] upsert error:', upsertError)
      throw new Error(`DB save failed: ${JSON.stringify(upsertError)}`)
    }

    console.log('[x-callback] saved x account for user', userId, '| @', xUser.username)
    return NextResponse.redirect(new URL('/dashboard?social_connected=true&platform=x', APP_URL))
  } catch (err) {
    console.error('[x-callback] error:', err)
    return NextResponse.redirect(new URL('/dashboard?social_error=token_exchange_failed', APP_URL))
  }
}
