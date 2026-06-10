/**
 * POST /api/social/debug/generate-response
 *
 * Dry-run the comment responder + DM chatbot WITHOUT posting to Instagram.
 * Lets us verify Brand Brain is driving the output, independent of the Meta webhook.
 *
 * Body: {
 *   ig_business_id?: string   // look up brand by IG account
 *   user_id?: string          // or look up by user (defaults to the logged-in user)
 *   comment_text: string
 *   post_caption?: string
 *   simulate_dm_trigger?: boolean   // force DM path on/off (otherwise uses keyword rules)
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getBrandByIgBusinessId,
  getBrandByUserId,
  brandFieldsLoaded,
  missingBrandFields,
} from '@/lib/agent/brand-brain'
import { previewResponse } from '@/lib/agent/comment-responder'

export async function POST(request: NextRequest) {
  // Require an authenticated session so this can't be abused publicly.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    ig_business_id?: string
    user_id?: string
    comment_text?: string
    post_caption?: string
    simulate_dm_trigger?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const commentText = body.comment_text?.trim()
  if (!commentText) {
    return NextResponse.json({ error: 'comment_text is required' }, { status: 400 })
  }

  // Resolve the Brand Brain: by IG account, explicit user, or the caller.
  const brand = body.ig_business_id
    ? await getBrandByIgBusinessId(body.ig_business_id)
    : await getBrandByUserId(body.user_id ?? user.id)

  if (!brand) {
    return NextResponse.json({
      error: 'No brand profile found for the given identifier',
      hint: 'Make sure brand_profiles.ig_business_id matches, or pass a valid user_id.',
    }, { status: 404 })
  }

  const result = await previewResponse({
    commentText,
    brand,
    postCaption: body.post_caption ?? null,
    simulateDmTrigger: body.simulate_dm_trigger,
  })

  return NextResponse.json({
    input: {
      comment_text: commentText,
      post_caption: body.post_caption ?? null,
      simulate_dm_trigger: body.simulate_dm_trigger ?? null,
    },
    brand_brain: {
      business_name: brand.business_name,
      tone: brand.tone,
      language: brand.language,
      dm_enabled: brand.dm_enabled,
      dm_trigger_mode: brand.dm_trigger_mode,
      dm_trigger_keywords: brand.dm_trigger_keywords,
      has_dm_template: !!brand.dm_template,
      cta_links: brand.cta_links,
      fields_loaded: brandFieldsLoaded(brand),
      fields_missing: missingBrandFields(brand),
    },
    route: result.route,
    dm_will_be_sent: result.dm_will_be_sent,
    generated_public_reply: result.public_reply,
    generated_dm_text: result.dm_text,
    selected_cta: result.cta_link ? { label: result.cta_label, url: result.cta_link } : null,
  })
}
