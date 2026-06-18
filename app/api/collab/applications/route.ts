/**
 * Collab applications — admin review API.
 * GET   — list all applications (admin only)
 * PATCH — update an application's status (admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAIL = 'tdong1919@gmail.com'
const STATUSES = ['pending', 'approved', 'declined', 'paused']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

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
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data, error } = await svc
    .from('collab_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id, status, notes } = body
  if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })

  const update: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() }
  if (typeof notes === 'string') update.notes = notes

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // On approval, mint a referral code if the applicant doesn't have one yet.
  if (status === 'approved') {
    const { data: current } = await svc
      .from('collab_applications')
      .select('referral_code, instagram_handle')
      .eq('id', id)
      .maybeSingle()
    if (current && !current.referral_code) {
      update.referral_code = await generateReferralCode(svc, current.instagram_handle)
    }
  }

  const { data, error } = await svc
    .from('collab_applications')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
