/**
 * Admin access self-service.
 * GET  — current user's admin level + pending/approved request status
 * POST — request an admin account (creates a pending row for superadmin review)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext, SUPERADMIN_EMAIL } from '@/lib/admin'

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data: request } = await svc
    .from('admin_accounts')
    .select('status, created_at, reviewed_at')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  return NextResponse.json({ level: ctx.level, isSuperadmin: ctx.level === 'superadmin', request: request ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.email === SUPERADMIN_EMAIL) {
    return NextResponse.json({ ok: true, already: true, level: 'superadmin' })
  }

  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data: existing } = await svc
    .from('admin_accounts')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, already: true, status: existing.status })
  }

  const { error } = await svc.from('admin_accounts').insert({
    user_id: user.id,
    email: user.email ?? null,
    status: 'pending',
    requested_reason: reason,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status: 'pending' })
}
