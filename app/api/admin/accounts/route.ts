/**
 * Admin account management — SUPERADMIN only.
 * GET   — list all admin requests/accounts
 * PATCH — approve or decline a request
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext } from '@/lib/admin'

export async function GET() {
  const ctx = await getAdminContext()
  if (ctx?.level !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data, error } = await svc
    .from('admin_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAdminContext()
  if (ctx?.level !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, status } = body
  if (!id || !['approved', 'declined', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data, error } = await svc
    .from('admin_accounts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: ctx.email })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
