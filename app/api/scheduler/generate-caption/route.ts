/**
 * POST /api/scheduler/generate-caption
 *
 * Turns a short content brief into a platform-optimized, SEO-aware caption
 * using the user's Brand Brain (voice, services, CTAs). The model returns the
 * final ready-to-post text (hashtags already placed/limited correctly for the
 * platform when requested) plus the hashtag list for display.
 *
 * Body: { description, platform?, content_type?, include_hashtags? }
 * Returns: { caption, hashtags }
 */
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getBrandByUserId } from '@/lib/agent/brand-brain'

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Per-platform SEO + formatting guidance.
const PLATFORM_GUIDE: Record<string, string> = {
  instagram: `Platform: INSTAGRAM.
- Open with a scroll-stopping hook in the first line (~125 chars show before "…more").
- Body up to ~600 chars, scannable with line breaks. Weave in searchable keywords naturally — Instagram search is keyword-based, so the caption doubles as SEO.
- End with one clear CTA.
- Hashtags (only if requested): 5–8 HIGHLY RELEVANT niche + mid-size tags placed on their own lines at the end. Never 30 spammy generic tags.`,
  facebook: `Platform: FACEBOOK.
- Conversational and a touch longer is fine. Lead with value or a question that invites comments.
- Plain-text links are fine. Optimize for shares/comments.
- Hashtags (only if requested): 0–2 max — hashtags barely help on Facebook.`,
  x: `Platform: X (Twitter).
- HARD LIMIT: the entire caption INCLUDING hashtags must be ≤ 280 characters.
- One sharp idea, strong hook, no fluff.
- Hashtags (only if requested): 1–2 inline, max.`,
  youtube: `Platform: YOUTUBE.
- This is a title line + description. Front-load the primary keyword in the first sentence (search SEO).
- Keyword-rich, helpful description; a CTA to subscribe.
- Hashtags (only if requested): 3–5 keyword hashtags at the end.`,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const description: string = (body.description ?? '').trim()
  const platform: string = body.platform ?? 'instagram'
  const contentType: string = body.content_type ?? 'post'
  const includeHashtags: boolean = body.include_hashtags !== false

  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const brand = await getBrandByUserId(user.id)
  const guide = PLATFORM_GUIDE[platform] ?? PLATFORM_GUIDE.instagram
  const emojiRule = brand?.emoji_allowed === false
    ? 'Do NOT use emojis.'
    : 'Use emojis tastefully where they fit the brand.'

  const brandCtx = brand
    ? `Brand: ${brand.business_name}
Tone: ${brand.tone}
Language: ${brand.language}
What they do: ${brand.description ?? 'N/A'}
Services/products: ${brand.services_products ?? 'N/A'}
Brand voice examples: ${brand.brand_voice_examples ?? 'none'}
Approved CTAs: ${brand.allowed_ctas ?? 'none'}
Website: ${brand.web_link ?? 'N/A'}`
    : 'No brand profile on file — keep it professional and neutral.'

  const systemPrompt = `You are an expert social media copywriter and SEO specialist.
Write ONE platform-optimized caption for a ${contentType.replace('_', ' ')}.

${guide}

${emojiRule}

Brand context:
${brandCtx}

Hard rules:
- NEVER invent prices, offers, guarantees, services, or facts not in the brand context.
- Match the brand's voice and language exactly.
- Make it natural and conversion-focused — not robotic or keyword-stuffed.
- ${includeHashtags ? 'INCLUDE platform-appropriate hashtags in the final caption text, formatted per the platform rules above.' : 'Do NOT include ANY hashtags.'}

Return ONLY valid JSON: {"caption": "<final ready-to-post text>", "hashtags": ["#tag1", "#tag2"]}.
The "caption" must be the complete text to post. "hashtags" lists the tags you used (empty array if none).`

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Content brief: ${description}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 600,
    })

    let parsed: { caption?: string; hashtags?: string[] } = {}
    try { parsed = JSON.parse(resp.choices[0]?.message?.content ?? '{}') } catch { /* fall through */ }

    const caption = (parsed.caption ?? '').trim() || description
    const hashtags = includeHashtags ? (parsed.hashtags ?? []) : []
    return NextResponse.json({ caption, hashtags })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Caption generation failed', caption: description, hashtags: [] },
      { status: 502 }
    )
  }
}
