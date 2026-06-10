/**
 * Brand Brain — fetch a user's brand profile by ig_business_id or user_id.
 * Used by all agent functions to inject brand context into AI prompts.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface CtaLink {
  label: string
  url: string
}

export interface BrandBrain {
  user_id: string
  business_name: string
  description: string | null
  tone: string
  language: string
  allowed_ctas: string | null
  cta_keywords: string[]
  web_link: string | null
  phone: string | null
  location: string | null
  hours: string | null
  services_products: string | null
  pricings: string | null
  emoji_allowed: boolean
  brand_voice_examples: string | null
  booking_link: string | null
  cta_links: CtaLink[]
  faq_1: string | null
  faq_2: string | null
  faq_3: string | null
  dm_enabled: boolean
  dm_trigger_keywords: string[]
  dm_trigger_mode: string
  dm_template: string | null
  escalation_rules: string | null
  // social account fields
  page_token: string | null
  page_id: string | null
  ig_business_id: string | null
  social_account_id: string | null
  // plan
  plan_limit: number
}

/** Brand Brain fields the agents rely on for high-quality, on-brand output. */
const KEY_BRAND_FIELDS = [
  'business_name', 'description', 'tone', 'language', 'services_products',
  'pricings', 'allowed_ctas', 'brand_voice_examples', 'faq_1',
  'booking_link', 'web_link', 'cta_links',
] as const

/** Returns the list of key fields that ARE populated (for debug logging). */
export function brandFieldsLoaded(brand: BrandBrain): string[] {
  return KEY_BRAND_FIELDS.filter((f) => {
    const v = (brand as unknown as Record<string, unknown>)[f]
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== undefined && String(v).trim() !== ''
  })
}

/** Returns the list of key fields that are MISSING/empty (surfaced in the debug endpoint). */
export function missingBrandFields(brand: BrandBrain): string[] {
  const loaded = new Set(brandFieldsLoaded(brand))
  return KEY_BRAND_FIELDS.filter((f) => !loaded.has(f))
}

export async function getBrandByIgBusinessId(igBusinessId: string): Promise<BrandBrain | null> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase as any)
    .from('social_accounts')
    .select('id, user_id, page_token_encrypted, page_id, external_account_id')
    .eq('external_account_id', igBusinessId)
    .eq('status', 'active')
    .maybeSingle() as { data: { id: string; user_id: string; page_token_encrypted: string | null; page_id: string | null; external_account_id: string | null } | null }

  if (!account) return null

  return buildBrainForUser(account.user_id, {
    page_token: account.page_token_encrypted,
    page_id: account.page_id,
    ig_business_id: account.external_account_id,
    social_account_id: account.id,
  })
}

export async function getBrandByUserId(userId: string): Promise<BrandBrain | null> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase as any)
    .from('social_accounts')
    .select('id, page_token_encrypted, page_id, external_account_id')
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .eq('status', 'active')
    .maybeSingle() as { data: { id: string; page_token_encrypted: string | null; page_id: string | null; external_account_id: string | null } | null }

  return buildBrainForUser(userId, {
    page_token: account?.page_token_encrypted ?? null,
    page_id: account?.page_id ?? null,
    ig_business_id: account?.external_account_id ?? null,
    social_account_id: account?.id ?? null,
  })
}

async function buildBrainForUser(
  userId: string,
  social: { page_token: string | null; page_id: string | null; ig_business_id: string | null; social_account_id: string | null }
): Promise<BrandBrain | null> {
  const supabase = createServiceClient()

  const [brandResult, subResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as Promise<{ data: Record<string, unknown> | null }>,
    supabase
      .from('subscriptions')
      .select('reply_limit, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle() as unknown as Promise<{ data: { reply_limit: number; status: string } | null }>,
  ])

  const brand = brandResult.data as (Record<string, unknown> & {
    business_name: string; description?: string; tone: string | string[]; language: string; website_url?: string;
    phone?: string; location?: string; hours?: string; services_products?: string; pricings?: string;
    emoji_allowed?: boolean; brand_voice_examples?: string; booking_link?: string;
    faq_1?: string; faq_2?: string; faq_3?: string; allowed_ctas?: string; cta_keywords?: string[];
    escalation_rules?: string; dm_enabled?: boolean; dm_trigger_keywords?: string[];
    dm_trigger_mode?: string; dm_template?: string; ig_business_id?: string; ig_username?: string; cta_links?: unknown;
  }) | null
  if (!brand) return null

  const toneStr = Array.isArray(brand.tone) ? brand.tone.join(', ') : (brand.tone ?? 'Friendly, Professional')

  return {
    user_id: userId,
    business_name: brand.business_name ?? '',
    description: brand.description ?? null,
    tone: toneStr,
    language: brand.language ?? 'English',
    allowed_ctas: brand.allowed_ctas ?? null,
    cta_keywords: brand.cta_keywords ?? [],
    web_link: brand.website_url ?? null,
    phone: brand.phone ?? null,
    location: brand.location ?? null,
    hours: brand.hours ?? null,
    services_products: brand.services_products ?? null,
    pricings: brand.pricings ?? null,
    emoji_allowed: brand.emoji_allowed ?? false,
    brand_voice_examples: brand.brand_voice_examples ?? null,
    booking_link: brand.booking_link ?? null,
    faq_1: brand.faq_1 ?? null,
    faq_2: brand.faq_2 ?? null,
    faq_3: brand.faq_3 ?? null,
    dm_enabled: brand.dm_enabled ?? false,
    dm_trigger_keywords: brand.dm_trigger_keywords ?? [],
    dm_trigger_mode: brand.dm_trigger_mode ?? 'keyword',
    dm_template: brand.dm_template ?? null,
    escalation_rules: brand.escalation_rules ?? null,
    cta_links: (brand.cta_links as CtaLink[]) ?? [],
    page_token: social.page_token,
    page_id: social.page_id,
    ig_business_id: social.ig_business_id,
    social_account_id: social.social_account_id,
    plan_limit: subResult.data?.reply_limit ?? 500,
  }
}
