import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AiReplyUpdate, ReplyStatus } from '@/lib/types/database'

const PAGE_SIZE = 20

// GET /api/inbox — list ai_replies with optional status filter and pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const VALID_STATUSES: ReplyStatus[] = ['pending', 'approved', 'rejected', 'posted']
  const rawStatus = searchParams.get('status')
  const status: ReplyStatus | null = rawStatus && (VALID_STATUSES as string[]).includes(rawStatus) ? (rawStatus as ReplyStatus) : null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  // Step 1: user's connected accounts (id, IG business id, platform)
  const { data: userAccounts } = await supabase
    .from('social_accounts')
    .select('id, external_account_id, platform')
    .eq('user_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (userAccounts ?? []) as any[]
  const accountIds = accounts.map((a) => a.id)
  const igBusinessIds = accounts.map((a) => a.external_account_id).filter(Boolean)
  const platformByAccountId: Record<string, string> = {}
  const platformByIgId: Record<string, string> = {}
  for (const a of accounts) {
    platformByAccountId[a.id] = a.platform ?? 'instagram'
    if (a.external_account_id) platformByIgId[a.external_account_id] = a.platform ?? 'instagram'
  }

  // All DM conversations (escalations + responses log). RLS scopes to the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allDms } = await (supabase as any)
    .from('dm_conversations')
    .select('id, social_account_id, recipient_ig_id, recipient_username, history, handoff_reason, conversation_stage, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dmRows = (allDms ?? []) as any[]
  const dms = dmRows.filter((d) => d.conversation_stage === 'escalated')

  // ── Per-platform responses log: everything the AI has sent ──
  type ResponseLogItem = {
    id: string; channel: 'comment' | 'dm'; platform: string;
    recipient: string; incoming_text: string; response_text: string; ts: string | null;
  }
  const responses: ResponseLogItem[] = []

  // DM responses (assistant turns), pairing each with the user message before it.
  for (const d of dmRows) {
    const platform = platformByAccountId[d.social_account_id] ?? 'instagram'
    const hist: Array<{ role: string; content: string; ts: string }> = Array.isArray(d.history) ? d.history : []
    hist.forEach((m, i) => {
      if (m.role !== 'assistant') return
      let incoming = ''
      for (let j = i - 1; j >= 0; j--) { if (hist[j].role === 'user') { incoming = hist[j].content; break } }
      responses.push({
        id: `dm:${d.id}:${i}`, channel: 'dm', platform,
        recipient: d.recipient_username ?? `IG ${d.recipient_ig_id}`,
        incoming_text: incoming, response_text: m.content, ts: m.ts ?? d.last_message_at,
      })
    })
  }

  // Comment responses (auto-posted replies) from the processing log.
  if (igBusinessIds.length > 0) {
    const { data: log } = await supabase
      .from('comment_processing_log')
      .select('id, ig_business_id, comment_text, response_text, processed_at')
      .in('ig_business_id', igBusinessIds)
      .eq('reply_status', 'replied')
      .order('processed_at', { ascending: false })
      .limit(100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of ((log ?? []) as any[])) {
      if (!r.response_text) continue
      responses.push({
        id: `c:${r.id}`, channel: 'comment',
        platform: platformByIgId[r.ig_business_id] ?? 'instagram',
        recipient: '(comment reply)', incoming_text: r.comment_text ?? '',
        response_text: r.response_text, ts: r.processed_at,
      })
    }
  }

  responses.sort((a, b) => new Date(b.ts ?? 0).getTime() - new Date(a.ts ?? 0).getTime())

  if (accountIds.length === 0) {
    return NextResponse.json({
      data: [], dms, responses,
      pagination: { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 },
    })
  }

  // Step 2: get comment IDs for those accounts
  const { data: userComments } = await supabase
    .from('comments')
    .select('id')
    .in('social_account_id', accountIds)

  const commentIds = (userComments ?? []).map((c: { id: string }) => c.id)

  if (commentIds.length === 0) {
    return NextResponse.json({
      data: [], dms, responses,
      pagination: { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 },
    })
  }

  // Step 3: query ai_replies with comment details
  let query = supabase
    .from('ai_replies')
    .select('*, comment:comments(*)', { count: 'exact' })
    .in('comment_id', commentIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    dms,
    responses,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    },
  })
}

// PATCH /api/inbox — bulk update reply statuses
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: { ids: string[]; update: AiReplyUpdate } = await request.json()
  const ALLOWED_UPDATE_FIELDS: (keyof AiReplyUpdate)[] = ['status', 'edited_text', 'rejection_reason']
  const _sanitizedUpdate = Object.fromEntries(
    Object.entries(body.update ?? {}).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k as keyof AiReplyUpdate))
  ) as AiReplyUpdate

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: 'ids must be a non-empty array' },
      { status: 400 }
    )
  }

  // TODO: validate ownership before updating
  // const { data, error } = await supabase
  //   .from('ai_replies')
  //   .update({ ...body.update, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
  //   .in('id', body.ids)
  //   .select()
  // if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: { updated: body.ids.length },
    message: `${body.ids.length} replies updated`,
  })
}
