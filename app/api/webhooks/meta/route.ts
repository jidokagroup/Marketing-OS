/**
 * Meta Webhook Handler (v3 - pure template)
 * Replaces: Autom8 Client Acquisition MAIN Workflow
 *
 * GET  — webhook verification (hub.challenge)
 * POST — comment events + DM events, routed per ig_business_id → user
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { getBrandByIgBusinessId } from '@/lib/agent/brand-brain'
import { handleComment } from '@/lib/agent/comment-responder'
import { handleDm } from '@/lib/agent/dm-chatbot'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'autom8_verify'

// Webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Webhook event handler
export async function POST(request: NextRequest) {
  let body: MetaWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Respond 200 immediately (Meta requires a fast ack), but keep the function
  // alive to finish processing via `after()` — a plain fire-and-forget promise
  // gets killed by the serverless runtime once the response is sent.
  after(async () => {
    try {
      await processWebhookAsync(body)
    } catch (err) {
      console.error('[webhook] processing error:', err)
    }
  })

  return NextResponse.json({ status: 'ok' })
}

async function processWebhookAsync(body: MetaWebhookPayload) {
  if (!body.entry?.length) return

  for (const entry of body.entry) {
    const igBusinessId = entry.id

    // Look up which Autom8 user owns this IG account
    const brand = await getBrandByIgBusinessId(igBusinessId)
    if (!brand) continue

    // Process all changes in this entry
    for (const change of entry.changes ?? []) {
      const value = change.value

      // ── Comment event ──
      if (change.field === 'comments' || value?.comment_id) {
        if (value.from?.id === igBusinessId) continue // skip own comments

        await handleComment(
          {
            ig_business_id: igBusinessId,
            comment_id: String(value.id ?? value.comment_id ?? ''),
            comment_text: value.text ?? value.message ?? '',
            commenter_id: value.from?.id ?? '',
            commenter_username: value.from?.username ?? null,
            page_id: value.media?.id ?? null,
            post_id: value.media?.id ?? null,
            is_self_comment: false,
          },
          brand
        )
      }

      // ── Messaging event (DMs) ──
      if (change.field === 'messages') {
        for (const msg of value.messages ?? []) {
          if (!msg.text) continue
          await handleDm(
            {
              sender_id: msg.from?.id ?? value.sender?.id ?? '',
              sender_name: null,
              message_text: msg.text,
              message_id: String(msg.mid ?? msg.id ?? ''),
            },
            brand
          )
        }
      }
    }

    // IG Webhook v2 format — messaging under messaging array
    for (const messaging of entry.messaging ?? []) {
      if (!messaging.message?.text) continue
      const senderId = messaging.sender?.id
      if (senderId === igBusinessId) continue // own message

      await handleDm(
        {
          sender_id: senderId ?? '',
          sender_name: null,
          message_text: messaging.message.text,
          message_id: messaging.message.mid ?? '',
        },
        brand
      )
    }
  }
}

// ── Types ──

interface MetaWebhookPayload {
  object: string
  entry: WebhookEntry[]
}

interface WebhookEntry {
  id: string
  changes?: WebhookChange[]
  messaging?: MessagingEvent[]
}

interface WebhookChange {
  field: string
  value: Record<string, unknown> & {
    id?: string
    comment_id?: string
    text?: string
    message?: string
    from?: { id: string; username?: string }
    media?: { id: string }
    messages?: Array<{ mid?: string; id?: string; text?: string; from?: { id: string } }>
    sender?: { id: string }
  }
}

interface MessagingEvent {
  sender?: { id: string }
  recipient?: { id: string }
  message?: { mid?: string; text?: string }
}
