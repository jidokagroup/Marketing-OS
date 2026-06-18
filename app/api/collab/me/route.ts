/**
 * Collaborator self-service — the logged-in user's own collab application
 * plus their referral count. Matches by user_id or email, backfilling
 * user_id on first email match.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // Find by user_id first, then fall back to email.
  let { data: app } = await svc
    .from('collab_applications')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!app && user.email) {
    const byEmail = await svc
      .from('collab_applications')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()
    app = byEmail.data
    // Backfill user_id so future lookups are direct.
    if (app && !app.user_id) {
      await svc.from('collab_applications').update({ user_id: user.id }).eq('id', app.id)
      app.user_id = user.id
    }
  }

  if (!app) return NextResponse.json({ application: null, referrals: 0 })

  let referrals = 0
  if (app.referral_code) {
    const { count } = await svc
      .from('collab_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referral_code', app.referral_code)
    referrals = count ?? 0
  }

  return NextResponse.json({ application: app, referrals })
}
