/**
 * Collab applications — admin review API (any approved admin).
 * GET   — list all applications enriched with referral + payout metrics
 * PATCH — update status, deliverable_status, or notes; mints a referral code
 *         and emails the collaborator on approval
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext } from '@/lib/admin'
import { computePayout, COMMISSION_PERCENT } from '@/lib/collab-payout'
import { sendCollabApprovalEmail } from '@/lib/notify'

const STATUSES = ['pending', 'approved', 'declined', 'paused']
const DELIVERABLE_STATUSES = ['pending', 'posted', 'complete', 'missed']
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.autom8ig.io'

function codeBase(handle: string | null): string {
  return (handle ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8) || 'CREATOR'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateReferralCode(svc: any, handle: string | null): Promise<string> {
  const base = codeBase(handle)
  for (let i = 0; i < 5; i++) {
    const code = `${base}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
    const { data } = await svc.from('collab_applications').select('id').eq('referral_code', code).maybeSingle()
    if (!data) return code
  }
  return `${base}${Date.now().toString(36).toUpperCase().slice(-4)}`
}

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx?.level) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data: apps, error } = await svc
    .from('collab_applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  // Enrich each application with referral counts + payout estimate.
  const enriched = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apps ?? []).map(async (a: any) => {
      let referrals = 0
      let referralsThisMonth = 0
      if (a.referral_code) {
        const total = await svc.from('collab_referrals').select('id', { count: 'exact', head: true }).eq('referral_code', a.referral_code)
        referrals = total.count ?? 0
        const month = await svc.from('collab_referrals').select('id', { count: 'exact', head: true }).eq('referral_code', a.referral_code).gte('created_at', monthStart.toISOString())
        referralsThisMonth = month.count ?? 0
      }
      const payout = await computePayout(svc, a.referral_code)
      return { ...a, referrals, referralsThisMonth, ...payout }
    })
  )

  return NextResponse.json({ data: enriched, commissionPercent: COMMISSION_PERCENT })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx?.level) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, status, notes, deliverable_status } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (status && !STATUSES.includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  if (deliverable_status && !DELIVERABLE_STATUSES.includes(deliverable_status)) {
    return NextResponse.json({ error: 'invalid deliverable_status' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (status) { update.status = status; update.reviewed_at = new Date().toISOString() }
  if (typeof notes === 'string') update.notes = notes
  if (deliverable_status) update.deliverable_status = deliverable_status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // On approval, mint a referral code if the applicant doesn't have one yet.
  let mintedCode: string | null = null
  if (status === 'approved') {
    const { data: current } = await svc
      .from('collab_applications')
      .select('referral_code, instagram_handle, status')
      .eq('id', id)
      .maybeSingle()
    if (current && !current.referral_code) {
      mintedCode = await generateReferralCode(svc, current.instagram_handle)
      update.referral_code = mintedCode
    } else {
      mintedCode = current?.referral_code ?? null
    }
  }

  const { data, error } = await svc
    .from('collab_applications')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Email the collaborator on a fresh approval (best-effort, env-gated).
  if (status === 'approved' && data?.email) {
    await sendCollabApprovalEmail({
      name: data.name,
      email: data.email,
      referralCode: data.referral_code ?? mintedCode,
      dashboardUrl: `${APP_URL}/collab-dashboard`,
    }).catch(() => {})
  }

  return NextResponse.json({ data })
}
