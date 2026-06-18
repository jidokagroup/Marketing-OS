/**
 * Record a referral attribution: the logged-in (newly signed-up) user came in
 * via a collaborator's referral code. Idempotent — one row per referred user.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // The code must belong to an approved collaborator.
  const { data: owner } = await svc
    .from('collab_applications')
    .select('id, user_id, email, status')
    .eq('referral_code', code)
    .maybeSingle()
  if (!owner || owner.status !== 'approved') {
    return NextResponse.json({ ok: false, error: 'invalid code' }, { status: 404 })
  }

  // No self-referral.
  if (owner.user_id === user.id || (owner.email && owner.email === user.email)) {
    return NextResponse.json({ ok: false, error: 'self-referral' }, { status: 400 })
  }

  // One attribution per user (unique referred_user_id). Ignore if already set.
  const { data: existing } = await svc
    .from('collab_referrals')
    .select('id')
    .eq('referred_user_id', user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, already: true })

  const { error } = await svc.from('collab_referrals').insert({
    referral_code: code,
    referred_user_id: user.id,
    referred_email: user.email ?? null,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
