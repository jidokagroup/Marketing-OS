'use server'

import { createClient } from '@/lib/supabase/server'
import type { BrandProfile, Service } from '@/lib/types/database'

export interface BrandProfileWithServices extends BrandProfile {
  services: Service[]
}

export async function getBrandProfile(): Promise<BrandProfileWithServices | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*, services(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as BrandProfileWithServices | null
}

export interface UpsertBrandInput {
  business_name: string
  industry?: string | null
  website_url?: string | null
  description?: string | null
  tone?: string[]
  tone_notes?: string | null
  cta_keywords?: string[]
  escalation_rules?: string | null
  emoji_allowed?: boolean
  formality_level?: number
  // Extended Brand Brain fields used by the comment responder & DM chatbot
  language?: string | null
  phone?: string | null
  location?: string | null
  hours?: string | null
  services_products?: string | null
  pricings?: string | null
  brand_voice_examples?: string | null
  web_link?: string | null
  booking_link?: string | null
  faq_1?: string | null
  faq_2?: string | null
  faq_3?: string | null
  allowed_ctas?: string | null
  cta_links?: { label: string; url: string }[]
  dm_enabled?: boolean
  dm_trigger_keywords?: string[]
  dm_trigger_mode?: string
  dm_template?: string | null
  services?: { service_name: string; price_range?: string | null }[]
}

export async function upsertBrandProfile(input: UpsertBrandInput): Promise<BrandProfileWithServices> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { services: serviceInputs, ...profileData } = input
  const now = new Date().toISOString()

  // Check whether a profile already exists for this user
  const { data: existing } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  let profileId: string
  if (existing?.id) {
    // Update existing row
    const { data, error } = await supabase
      .from('brand_profiles')
      .update({ ...profileData, updated_at: now })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    profileId = data.id
  } else {
    // Insert new row
    const { data, error } = await supabase
      .from('brand_profiles')
      .insert({ ...profileData, user_id: user.id, updated_at: now, created_at: now })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    profileId = data.id
  }

  if (serviceInputs !== undefined) {
    await supabase.from('services').delete().eq('brand_id', profileId)
    if (serviceInputs.length > 0) {
      const { error: svcError } = await supabase.from('services').insert(
        serviceInputs.map((s, i) => ({
          brand_id: profileId,
          service_name: s.service_name,
          price_range: s.price_range ?? null,
          sort_order: i,
        }))
      )
      if (svcError) throw new Error(svcError.message)
    }
  }

  const { data: result, error: fetchError } = await supabase
    .from('brand_profiles')
    .select('*, services(*)')
    .eq('id', profileId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  return result as BrandProfileWithServices
}
