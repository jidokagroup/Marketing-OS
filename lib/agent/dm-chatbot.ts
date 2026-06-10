/**
 * DM Chatbot Agent
 * Handles incoming Instagram DMs, maintains conversation history,
 * escalates when needed. Multi-tenant by user_id via social_account.
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/service'
import type { BrandBrain } from './brand-brain'
import { buildBrandContext, generateDmText } from './comment-responder'

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MAX_MESSAGES_BEFORE_ESCALATION = 8

interface DmEvent {
  sender_id: string
  sender_name: string | null
  message_text: string
  message_id: string
}

interface DmResult {
  status: 'replied' | 'escalated' | 'skipped'
  reply_text?: string
}

function pickBestLink(brand: BrandBrain): string {
  const links = brand.cta_links ?? []
  if (links.length > 0) return links[0].url
  return brand.booking_link || brand.web_link || 'https://www.autom8ig.io'
}

/** True when the user is clearly asking how/where to buy, sign up, or get the link. */
function wantsLink(text: string): boolean {
  const lower = text.toLowerCase()
  return ['link', 'sign up', 'signup', 'where', 'how do i', 'how to', 'get started',
    'buy', 'subscribe', 'join', 'register', 'checkout', 'book'].some(k => lower.includes(k))
}

export async function handleDm(event: DmEvent, brand: BrandBrain): Promise<DmResult> {
  if (!brand.dm_enabled) return { status: 'skipped' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // Fetch or create conversation
  const { data: convo } = await supabase
    .from('dm_conversations')
    .select('*')
    .eq('user_id', brand.user_id)
    .eq('recipient_ig_id', event.sender_id)
    .maybeSingle()

  const history: Array<{ role: string; content: string; ts: string }> = convo?.history ?? []
  const messageCount = convo?.message_count ?? 0
  const stage = convo?.conversation_stage ?? 'active'

  if (stage === 'escalated') return { status: 'escalated' }

  // Add incoming message to history
  history.push({ role: 'user', content: event.message_text, ts: new Date().toISOString() })

  // Escalate first on sensitive intent or conversation length — never let AI handle these.
  const shouldEscalate = messageCount >= MAX_MESSAGES_BEFORE_ESCALATION ||
    detectEscalationIntent(event.message_text)

  if (shouldEscalate) {
    await supabase.from('dm_conversations').upsert({
      user_id: brand.user_id,
      social_account_id: brand.social_account_id,
      recipient_ig_id: event.sender_id,
      recipient_username: event.sender_name,
      conversation_stage: 'escalated',
      history,
      message_count: messageCount + 1,
      last_message_at: new Date().toISOString(),
      handoff_reason: messageCount >= MAX_MESSAGES_BEFORE_ESCALATION
        ? 'max_messages_reached'
        : 'escalation_intent_detected',
    }, { onConflict: 'user_id,recipient_ig_id' })
    return { status: 'escalated' }
  }

  let replyText: string

  if (history.length === 1) {
    // First contact — personalized opener using the brand's template (or AI), link guaranteed.
    const { text } = await generateDmText(event.message_text, brand, null)
    replyText = text
  } else {
    // Ongoing conversation — answer the actual message using brand context + history.
    replyText = await generateDmReply(history, brand, event.message_text)
  }

  // Send via IG Messaging API
  if (brand.page_token && brand.ig_business_id) {
    await sendIgDm(brand.ig_business_id, event.sender_id, replyText, brand.page_token)
  }

  // Persist conversation
  history.push({ role: 'assistant', content: replyText, ts: new Date().toISOString() })
  await supabase.from('dm_conversations').upsert({
    user_id: brand.user_id,
    social_account_id: brand.social_account_id,
    recipient_ig_id: event.sender_id,
    recipient_username: event.sender_name,
    conversation_stage: 'active',
    history,
    message_count: messageCount + 1,
    last_message_at: new Date().toISOString(),
  }, { onConflict: 'user_id,recipient_ig_id' })

  return { status: 'replied', reply_text: replyText }
}

function detectEscalationIntent(text: string): boolean {
  const triggers = ['refund', 'cancel', 'billing', 'lawsuit', 'legal', 'fraud', 'scam', 'human', 'manager', 'speak to someone']
  const lower = text.toLowerCase()
  return triggers.some(t => lower.includes(t))
}

/**
 * Generates a contextual follow-up DM that answers the user's actual message,
 * grounded in Brand Brain. Never invents pricing; injects a CTA link when the
 * user is asking how/where to buy or sign up.
 */
export async function generateDmReply(
  history: Array<{ role: string; content: string; ts: string }>,
  brand: BrandBrain,
  latestUserMessage: string
): Promise<string> {
  const emojiRule = brand.emoji_allowed ? 'Light emoji use is welcome.' : 'No emojis.'

  const systemPrompt = `You are the Instagram DM assistant for ${brand.business_name}.
Sound human, warm, and helpful. Tone: ${brand.tone}. Language: ${brand.language}. ${emojiRule}
Keep replies under 60 words. No hashtags.

Hard rules:
- Answer the person's LATEST message directly — do not resend a generic greeting or template.
- Only state pricing if it appears in the brand info. If they ask about price and it's not listed, say the team can confirm exact details and offer the link.
- NEVER invent offers, guarantees, services, or facts not in the brand info.
- If you don't know, say you'll check / point them to the right place.

Brand info:
${buildBrandContext(brand)}

Return ONLY the reply text.`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ]

  const res = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 160,
    temperature: 0.7,
  })

  let reply = res.choices[0]?.message?.content?.trim() ||
    "Great question! Let me point you in the right direction."

  // If they're clearly asking how/where to act, make sure a link is present.
  if (wantsLink(latestUserMessage)) {
    const link = pickBestLink(brand)
    if (!reply.includes(link)) reply = `${reply}\n\n${brand.emoji_allowed ? '👉 ' : ''}${link}`
  }

  return reply
}

async function sendIgDm(igBusinessId: string, recipientId: string, text: string, pageToken: string): Promise<void> {
  await fetch(`https://graph.facebook.com/v23.0/${igBusinessId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: pageToken,
    }),
  })
}
