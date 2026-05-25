import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/social/mark-connected
// Called from /connection_successful after n8n OAuth flow completes.
// Body: { ig_business_id?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const igBusinessId: string | null = body.ig_business_id ?? null

  const { error: socialError } = await supabase
    .from('social_accounts')
    .upsert(
      {
        user_id: user.id,
        platform: 'instagram',
        external_account_id: igBusinessId,
        connected_at: new Date().toISOString(),
        status: 'active',
      },
      { onConflict: 'user_id,platform' }
    )

  if (socialError) {
    console.error('Failed to mark social account connected:', socialError)
    return NextResponse.json({ error: socialError.message }, { status: 500 })
  }

  // Also persist ig_business_id on brand_profiles so Brand Brain sync always has it
  if (igBusinessId) {
    await supabase
      .from('brand_profiles')
      .upsert(
        { user_id: user.id, business_name: '', ig_business_id: igBusinessId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  return NextResponse.json({ success: true })
}
