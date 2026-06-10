/**
 * Comment Responder Agent
 * Replicates: Autom8 Client Acquisition MAIN Workflow (comment branch)
 *
 * Flow:
 * 1. Deduplicate via comment_processing_log
 * 2. Check usage gate
 * 3. Classify comment (auto-reply vs human review)
 * 4. Generate AI reply (brand-voice aware)
 * 5. Check DM trigger keywords
 * 6. Auto-post reply OR queue for human review
 * 7. Optionally send DM
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/service'
import { brandFieldsLoaded, type BrandBrain } from './brand-brain'
import { checkAndIncrementUsage } from './usage'

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface CommentEvent {
  ig_business_id: string
  comment_id: string
  comment_text: string
  commenter_id: string
  commenter_username: string | null
  page_id: string | null
  post_id: string | null
  is_self_comment: boolean
}

async function fetchPostCaption(postId: string, pageToken: string): Promise<string | null> {
  if (!postId || !pageToken) return null
  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${postId}?fields=caption,media_type&access_token=${pageToken}`
    )
    const data = await res.json()
    return data.caption ?? null
  } catch {
    return null
  }
}

interface ReplyResult {
  status: 'auto_posted' | 'queued_review' | 'skipped' | 'limit_reached' | 'duplicate'
  reply_text?: string
  dm_queued?: boolean
}

export async function handleComment(event: CommentEvent, brand: BrandBrain): Promise<ReplyResult> {
  console.log('[handleComment]', JSON.stringify({
    comment: event.comment_text,
    brand_loaded: brandFieldsLoaded(brand),
    dm_enabled: brand.dm_enabled,
    dm_trigger_mode: brand.dm_trigger_mode,
    dm_trigger_keywords: brand.dm_trigger_keywords,
    has_template: !!brand.dm_template,
    cta_links: brand.cta_links?.length ?? 0,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // 1. Deduplicate
  const { error: dedupError } = await supabase
    .from('comment_processing_log')
    .insert({
      ig_business_id: event.ig_business_id,
      comment_id: event.comment_id,
      comment_text: event.comment_text,
      reply_status: 'processing',
    })

  if (dedupError) {
    // unique constraint violation = already processed
    return { status: 'duplicate' }
  }

  // 2. Usage gate
  const usage = await checkAndIncrementUsage(brand.user_id)
  if (!usage.can_run) {
    await supabase
      .from('comment_processing_log')
      .update({ reply_status: 'skipped' })
      .eq('ig_business_id', event.ig_business_id)
      .eq('comment_id', event.comment_id)
    return { status: 'limit_reached' }
  }

  // 3. Fetch post caption for context
  const postCaption = event.post_id && brand.page_token
    ? await fetchPostCaption(event.post_id, brand.page_token)
    : null

  // 4. Classify — check escalation conditions
  const route = classifyComment(event.comment_text, brand)

  // 5. Check DM keyword trigger (needed before generating reply)
  const shouldDm = brand.dm_enabled && checkDmTrigger(event.comment_text, brand)

  // 6. Generate reply — use buying-intent shortcuts before hitting AI
  const replyText = await generateReply(event.comment_text, brand, route === 'human_review', postCaption, shouldDm)

  // 6. Store in comments + ai_replies tables
  const { data: commentRow } = await supabase
    .from('comments')
    .upsert({
      social_account_id: brand.social_account_id!,
      external_comment_id: event.comment_id,
      commenter_username: event.commenter_username,
      comment_text: event.comment_text,
    }, { onConflict: 'external_comment_id' })
    .select('id')
    .single()

  if (commentRow) {
    await supabase.from('ai_replies').insert({
      comment_id: commentRow.id,
      draft_text: replyText,
      status: route === 'human_review' ? 'pending' : 'approved',
    })
  }

  // 7. If auto-reply, post to IG Graph API
  if (route === 'auto_reply' && brand.page_token) {
    const posted = await postReplyToInstagram(event.comment_id, replyText, brand.page_token)
    if (posted) {
      await supabase
        .from('comment_processing_log')
        .update({ reply_status: 'replied', response_text: replyText })
        .eq('ig_business_id', event.ig_business_id)
        .eq('comment_id', event.comment_id)

      if (shouldDm && brand.page_token) {
        await sendDmFromComment(event, brand, replyText, postCaption)
      }

      return { status: 'auto_posted', reply_text: replyText, dm_queued: shouldDm }
    }
  }

  await supabase
    .from('comment_processing_log')
    .update({ reply_status: 'replied', response_text: replyText })
    .eq('ig_business_id', event.ig_business_id)
    .eq('comment_id', event.comment_id)

  return { status: 'queued_review', reply_text: replyText, dm_queued: shouldDm }
}

/**
 * Dry-run the full response pipeline WITHOUT posting to Instagram.
 * Powers POST /api/social/debug/generate-response so responses can be tested
 * independently of the Meta webhook.
 */
export async function previewResponse(opts: {
  commentText: string
  brand: BrandBrain
  postCaption?: string | null
  simulateDmTrigger?: boolean
}): Promise<{
  route: 'auto_reply' | 'human_review'
  dm_will_be_sent: boolean
  public_reply: string
  dm_text: string | null
  cta_link: string | null
  cta_label: string | null
}> {
  const { commentText, brand, postCaption = null } = opts
  const route = classifyComment(commentText, brand)
  const keywordTrigger = brand.dm_enabled && checkDmTrigger(commentText, brand)
  const dm_will_be_sent = opts.simulateDmTrigger ?? keywordTrigger

  const public_reply = await generateReply(commentText, brand, route === 'human_review', postCaption, dm_will_be_sent)

  let dm_text: string | null = null
  let cta_link: string | null = null
  let cta_label: string | null = null
  if (dm_will_be_sent) {
    const dm = await generateDmText(commentText, brand, postCaption)
    dm_text = dm.text
    cta_link = dm.link
    cta_label = dm.linkLabel
  }

  return { route, dm_will_be_sent, public_reply, dm_text, cta_link, cta_label }
}

function classifyComment(text: string, brand: BrandBrain): 'auto_reply' | 'human_review' {
  const escalationTriggers = [
    'refund', 'cancel', 'billing', 'charge', 'lawsuit', 'legal', 'fraud',
    'scam', 'hate', 'threat', 'harassment', 'human', 'manager', 'supervisor',
  ]
  const lower = text.toLowerCase()
  if (escalationTriggers.some(t => lower.includes(t))) return 'human_review'
  if (brand.escalation_rules) {
    const customTriggers = brand.escalation_rules.toLowerCase()
    if (escalationTriggers.some(t => customTriggers.includes(t) && lower.includes(t))) return 'human_review'
  }
  return 'auto_reply'
}

function checkDmTrigger(text: string, brand: BrandBrain): boolean {
  if (!brand.dm_trigger_keywords?.length) return false
  const lower = text.toLowerCase()
  const mode = brand.dm_trigger_mode ?? 'keyword'
  if (mode === 'always') return true
  return brand.dm_trigger_keywords.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Builds the shared "brand context" block injected into every AI prompt.
 * Only includes fields that are actually set, so the model is never fed
 * "not provided" noise and can't hallucinate around empty values.
 */
export function buildBrandContext(brand: BrandBrain, postCaption: string | null = null): string {
  const lines: string[] = []
  const add = (label: string, val: string | null | undefined) => {
    if (val && String(val).trim()) lines.push(`- ${label}: ${String(val).trim()}`)
  }
  add('Business', brand.business_name)
  add('What they do', brand.description)
  add('Services / products', brand.services_products)
  add('Pricing', brand.pricings)
  add('Hours', brand.hours)
  add('Location', brand.location)
  add('Phone', brand.phone)
  add('Website', brand.web_link)
  add('Booking link', brand.booking_link)
  if (brand.cta_links?.length) {
    add('Links', brand.cta_links.map(l => `${l.label} → ${l.url}`).join(' | '))
  }
  add('Approved CTAs', brand.allowed_ctas)
  add('FAQ', [brand.faq_1, brand.faq_2, brand.faq_3].filter(Boolean).join(' • ') || null)
  add('Brand voice examples', brand.brand_voice_examples)
  if (postCaption) add('The post they commented on', postCaption.slice(0, 400))
  return lines.join('\n')
}

/**
 * Generates the PUBLIC comment reply using the full Brand Brain.
 * - If a DM is being sent, the public reply is a short, varied nudge to the DMs.
 * - Otherwise it answers the comment directly using brand info.
 * Never invents prices/offers; respects tone, language, and emoji settings.
 */
async function generateReply(
  commentText: string,
  brand: BrandBrain,
  isHumanReview: boolean,
  postCaption: string | null,
  dmWillBeSent: boolean
): Promise<string> {
  // Human-review drafts are never auto-posted, but we still draft a strong suggestion.
  const emojiRule = brand.emoji_allowed
    ? 'A tasteful emoji or two is fine.'
    : 'Do NOT use any emojis.'

  const intent = isHumanReview
    ? `This comment was flagged for human review (sensitive topic). Draft a calm, empathetic reply a human can approve. Never admit fault or make promises; invite them to continue privately.`
    : dmWillBeSent
      ? `A DM with full details is being sent to this person right now. Write a SHORT public reply (max 140 characters) that feels personal to their comment and the post, and tells them to check their DMs. Vary your wording naturally — do not sound templated.`
      : `Answer their comment directly and helpfully using ONLY the brand info below. If a relevant link or CTA exists, include it naturally. Keep it under 220 characters.`

  const systemPrompt = `You are the Instagram community manager for ${brand.business_name}.
Write in this brand's voice. Tone: ${brand.tone}. Language: ${brand.language}.
${emojiRule}

Hard rules:
- NEVER invent prices, offers, guarantees, services, or facts not in the brand info.
- If you don't know something, point them to a link or offer to help — don't make it up.
- Sound like a real human, not a bot. Avoid generic filler like "Thanks for reaching out! Let us know if you have questions."
- No hashtags. One short paragraph only.

${intent}

Brand info:
${buildBrandContext(brand, postCaption)}

Return ONLY the reply text.`

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Comment from @user: "${commentText}"` },
    ],
    max_tokens: 160,
    temperature: 0.8,
  })

  return (
    response.choices[0]?.message?.content?.trim() ||
    // Fallback only if the AI call itself fails/returns empty
    (dmWillBeSent ? 'Just sent you a DM with the details! 🙌' : "Thanks so much! I'll follow up with more info.")
  )
}

async function postReplyToInstagram(commentId: string, message: string, pageToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${commentId}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message, access_token: pageToken }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

async function sendDmFromComment(event: CommentEvent, brand: BrandBrain, _commentReply: string, postCaption: string | null = null): Promise<void> {
  if (!brand.page_token || !brand.ig_business_id) return

  // Generate a personalized DM (AI opener/personalization) with a guaranteed CTA link.
  const { text: dmText } = await generateDmText(event.comment_text, brand, postCaption)
  if (!dmText) return

  try {
    await fetch(`https://graph.facebook.com/v23.0/${brand.ig_business_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: event.commenter_id },
        message: { text: dmText },
        access_token: brand.page_token,
      }),
    })

    // Store DM conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any
    await supabase.from('dm_conversations').upsert({
      user_id: brand.user_id,
      social_account_id: brand.social_account_id,
      recipient_ig_id: event.commenter_id,
      recipient_username: event.commenter_username,
      trigger_source: 'comment_keyword',
      matched_keyword: brand.dm_trigger_keywords?.[0] ?? null,
      history: [
        { role: 'assistant', content: dmText, ts: new Date().toISOString() },
      ],
      message_count: 1,
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'user_id,recipient_ig_id' })
  } catch {
    // non-fatal
  }
}

async function selectCtaLink(commentText: string, postCaption: string | null, brand: BrandBrain): Promise<{ label: string; url: string }> {
  const links = brand.cta_links ?? []
  if (links.length === 0) {
    const url = brand.booking_link || brand.web_link || 'https://www.autom8ig.io'
    return { label: 'Get Started', url }
  }
  if (links.length === 1) return links[0]

  // Use GPT to pick the most relevant link based on context
  const linkList = links.map((l, i) => `${i + 1}. ${l.label}: ${l.url}`).join('\n')
  const res = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Given a post caption and a comment, pick the single most relevant link to send in a DM. Return ONLY the number (1, 2, 3, etc).`,
      },
      {
        role: 'user',
        content: `Post caption: "${postCaption ?? 'N/A'}"\nComment: "${commentText}"\n\nLinks:\n${linkList}`,
      },
    ],
    max_tokens: 5,
    temperature: 0,
  })
  const pick = parseInt(res.choices[0]?.message?.content?.trim() ?? '1', 10)
  return links[(pick - 1)] ?? links[0]
}

/** Guarantee the CTA url appears in the message; append it if the model dropped it. */
function ensureLink(text: string, url: string, emoji: boolean): string {
  if (text.includes(url)) return text
  return `${text.trim()}\n\n${emoji ? '👉 ' : ''}${url}`
}

/**
 * Generates the first DM sent off the back of a comment.
 * Uses the brand's dm_template when provided (personalized to the comment),
 * otherwise an AI opener. The selected CTA link is always force-injected.
 */
export async function generateDmText(
  commentText: string,
  brand: BrandBrain,
  postCaption: string | null
): Promise<{ text: string; link: string; linkLabel: string }> {
  const chosen = await selectCtaLink(commentText, postCaption, brand)
  const url = chosen.url
  const name = brand.business_name || 'us'
  const emojiRule = brand.emoji_allowed ? 'Light emoji use is welcome.' : 'No emojis.'

  let text: string

  if (brand.dm_template && brand.dm_template.trim()) {
    // Personalize the user's own template to this specific comment, keeping the {link} slot.
    const res = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write Instagram DMs for ${brand.business_name}. Tone: ${brand.tone}. Language: ${brand.language}. ${emojiRule}
Adapt the TEMPLATE below so it speaks directly to what the person commented — keep it concise and natural.
Keep the {link} placeholder exactly where a link should go. Keep {business_name} if present. No hashtags.
Return ONLY the message.`,
        },
        {
          role: 'user',
          content: `Their comment: "${commentText}"
Post caption: "${postCaption ?? 'N/A'}"

TEMPLATE:
${brand.dm_template}`,
        },
      ],
      max_tokens: 180,
      temperature: 0.6,
    })
    text = (res.choices[0]?.message?.content?.trim() || brand.dm_template)
      .replaceAll('{link}', url)
      .replaceAll('{business_name}', name)
      .replaceAll('{name}', name)
  } else {
    // No template: AI opener referencing their comment, then the hardcoded link.
    const res = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Write a short, warm Instagram DM (under 45 words) for ${brand.business_name} replying to someone who commented. Tone: ${brand.tone}. Language: ${brand.language}. ${emojiRule}
Reference their comment, then invite them to the link. Do NOT invent prices or claims. No hashtags. Return ONLY the message.`,
        },
        {
          role: 'user',
          content: `Their comment: "${commentText}"
Post caption: "${postCaption ?? 'N/A'}"
${brand.pricings ? `Pricing (use only if relevant): ${brand.pricings}` : ''}
Link to share: ${url}`,
        },
      ],
      max_tokens: 140,
      temperature: 0.7,
    })
    text = res.choices[0]?.message?.content?.trim() ||
      `Hey! Thanks for your comment on ${name}'s post — here's the link to get started:`
  }

  return { text: ensureLink(text, url, brand.emoji_allowed), link: url, linkLabel: chosen.label }
}
