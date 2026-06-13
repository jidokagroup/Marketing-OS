import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const X_CLIENT_ID = process.env.X_CLIENT_ID ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.autom8ig.io'
const REDIRECT_URI = `${APP_URL}/api/social/callback/x`

const SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
]

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function buildXAuthResponse(request: NextRequest, asRedirect: boolean) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    if (asRedirect) return NextResponse.redirect(new URL('/login', APP_URL))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  )
  const state = base64url(crypto.randomBytes(16))

  const cookieStore = await cookies()
  cookieStore.set('x_pkce', JSON.stringify({ codeVerifier, state, userId: user.id }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', X_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  if (asRedirect) return NextResponse.redirect(authUrl)
  return NextResponse.json({ authUrl: authUrl.toString() })
}

// GET /api/social/connect/x — direct navigation (like YouTube connect)
export async function GET(request: NextRequest) {
  return buildXAuthResponse(request, true)
}

// POST /api/social/connect/x — called from JS fetch, returns JSON with authUrl
export async function POST(request: NextRequest) {
  return buildXAuthResponse(request, false)
}
