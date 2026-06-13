// Auto-generated TypeScript types for the Autom8 Supabase schema.
// Regenerate with: npx supabase gen types typescript --local > lib/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ---------------------------------------------------------------------------
// Row / Insert / Update types per table
// ---------------------------------------------------------------------------

// supabase-js v2 requires Relationships on every table definition for type inference to work.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      brand_profiles: {
        Row: BrandProfile
        Insert: BrandProfileInsert
        Update: BrandProfileUpdate
        Relationships: []
      }
      services: {
        Row: Service
        Insert: ServiceInsert
        Update: ServiceUpdate
        Relationships: []
      }
      social_accounts: {
        Row: SocialAccount
        Insert: SocialAccountInsert
        Update: SocialAccountUpdate
        Relationships: []
      }
      comments: {
        Row: Comment
        Insert: CommentInsert
        Update: CommentUpdate
        Relationships: []
      }
      ai_replies: {
        Row: AiReply
        Insert: AiReplyInsert
        Update: AiReplyUpdate
        Relationships: []
      }
      usage_events: {
        Row: UsageEvent
        Insert: UsageEventInsert
        Update: Record<string, never>
        Relationships: []
      }
      subscriptions: {
        Row: Subscription
        Insert: SubscriptionInsert
        Update: SubscriptionUpdate
        Relationships: []
      }
      user_preferences: {
        Row: UserPreferences
        Insert: UserPreferencesInsert
        Update: UserPreferencesUpdate
        Relationships: []
      }
      waitlist_entries: {
        Row: WaitlistEntry
        Insert: WaitlistEntryInsert
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: { [K in never]: never }
    Functions: { [K in never]: never }
    Enums: {
      social_platform: SocialPlatform
      reply_status: ReplyStatus
      subscription_plan: SubscriptionPlan
      subscription_status: SubscriptionStatus
      usage_event_type: UsageEventType
    }
    CompositeTypes: { [K in never]: never }
  }
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type SocialPlatform = 'instagram' | 'facebook' | 'x'
export type ReplyStatus = 'pending' | 'approved' | 'rejected' | 'posted'
export type SubscriptionPlan =
  | 'starter'
  | 'growth'
  | 'scale'
  | 'agency_starter'
  | 'agency_growth'
  | 'agency_pro'
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
export type UsageEventType = 'reply_generated' | 'reply_posted'
export type SocialAccountStatus = 'pending' | 'active' | 'expired' | 'disconnected'

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface ProfileInsert {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  created_at?: string
}

export interface ProfileUpdate {
  full_name?: string | null
  avatar_url?: string | null
}

// ---------------------------------------------------------------------------
// brand_profiles
// ---------------------------------------------------------------------------

export interface BrandProfile {
  id: string
  user_id: string
  business_name: string
  industry: string | null
  website_url: string | null
  description: string | null
  tone: string[]
  tone_notes: string | null
  cta_keywords: string[]
  escalation_rules: string | null
  emoji_allowed: boolean
  formality_level: number
  created_at: string
  updated_at: string
  language: string | null
  phone: string | null
  location: string | null
  hours: string | null
  services_products: string | null
  pricings: string | null
  brand_voice_examples: string | null
  booking_link: string | null
  faq_1: string | null
  faq_2: string | null
  faq_3: string | null
  allowed_ctas: string | null
  ig_business_id: string | null
}

export interface BrandProfileInsert {
  id?: string
  user_id: string
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
  created_at?: string
  updated_at?: string
  language?: string | null
  phone?: string | null
  location?: string | null
  hours?: string | null
  services_products?: string | null
  pricings?: string | null
  brand_voice_examples?: string | null
  booking_link?: string | null
  faq_1?: string | null
  faq_2?: string | null
  faq_3?: string | null
  allowed_ctas?: string | null
  ig_business_id?: string | null
}

export interface BrandProfileUpdate {
  business_name?: string
  industry?: string | null
  website_url?: string | null
  description?: string | null
  tone?: string[]
  tone_notes?: string | null
  cta_keywords?: string[]
  escalation_rules?: string | null
  emoji_allowed?: boolean
  formality_level?: number
  updated_at?: string
  language?: string | null
  phone?: string | null
  location?: string | null
  hours?: string | null
  services_products?: string | null
  pricings?: string | null
  brand_voice_examples?: string | null
  booking_link?: string | null
  faq_1?: string | null
  faq_2?: string | null
  faq_3?: string | null
  allowed_ctas?: string | null
  ig_business_id?: string | null
}

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------

export interface Service {
  id: string
  brand_id: string
  service_name: string
  price_range: string | null
  sort_order: number
}

export interface ServiceInsert {
  id?: string
  brand_id: string
  service_name: string
  price_range?: string | null
  sort_order?: number
}

export interface ServiceUpdate {
  service_name?: string
  price_range?: string | null
  sort_order?: number
}

// ---------------------------------------------------------------------------
// social_accounts
// ---------------------------------------------------------------------------

export interface SocialAccount {
  id: string
  user_id: string
  platform: SocialPlatform
  external_account_id: string | null
  access_token_encrypted: string | null
  connected_at: string | null
  status: SocialAccountStatus
}

export interface SocialAccountInsert {
  id?: string
  user_id: string
  platform: SocialPlatform
  external_account_id?: string | null
  access_token_encrypted?: string | null
  connected_at?: string | null
  status?: SocialAccountStatus
}

export interface SocialAccountUpdate {
  external_account_id?: string | null
  access_token_encrypted?: string | null
  connected_at?: string | null
  status?: SocialAccountStatus
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

export interface Comment {
  id: string
  social_account_id: string
  external_comment_id: string | null
  commenter_username: string | null
  comment_text: string
  post_url: string | null
  received_at: string
}

export interface CommentInsert {
  id?: string
  social_account_id: string
  external_comment_id?: string | null
  commenter_username?: string | null
  comment_text: string
  post_url?: string | null
  received_at?: string
}

export interface CommentUpdate {
  commenter_username?: string | null
  comment_text?: string
  post_url?: string | null
}

// ---------------------------------------------------------------------------
// ai_replies
// ---------------------------------------------------------------------------

export interface AiReply {
  id: string
  comment_id: string
  draft_text: string
  edited_text: string | null
  status: ReplyStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface AiReplyInsert {
  id?: string
  comment_id: string
  draft_text: string
  edited_text?: string | null
  status?: ReplyStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  created_at?: string
}

export interface AiReplyUpdate {
  edited_text?: string | null
  status?: ReplyStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
}

// ---------------------------------------------------------------------------
// usage_events
// ---------------------------------------------------------------------------

export interface UsageEvent {
  id: string
  user_id: string
  event_type: UsageEventType
  occurred_at: string
  billing_period_start: string
}

export interface UsageEventInsert {
  id?: string
  user_id: string
  event_type: UsageEventType
  occurred_at?: string
  billing_period_start: string
}

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  reply_limit: number
  created_at: string
  updated_at: string
}

export interface SubscriptionInsert {
  id?: string
  user_id: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  plan?: SubscriptionPlan
  status?: SubscriptionStatus
  current_period_start?: string | null
  current_period_end?: string | null
  reply_limit?: number
  created_at?: string
  updated_at?: string
}

export interface SubscriptionUpdate {
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  plan?: SubscriptionPlan
  status?: SubscriptionStatus
  current_period_start?: string | null
  current_period_end?: string | null
  reply_limit?: number
  updated_at?: string
}

// ---------------------------------------------------------------------------
// user_preferences
// ---------------------------------------------------------------------------

export interface UserPreferences {
  id: string
  user_id: string
  weekly_digest: boolean
  reply_reminders: boolean
  usage_alerts: boolean
  created_at: string
  updated_at: string
}

export interface UserPreferencesInsert {
  id?: string
  user_id: string
  weekly_digest?: boolean
  reply_reminders?: boolean
  usage_alerts?: boolean
  created_at?: string
  updated_at?: string
}

export interface UserPreferencesUpdate {
  weekly_digest?: boolean
  reply_reminders?: boolean
  usage_alerts?: boolean
  updated_at?: string
}

// ---------------------------------------------------------------------------
// waitlist_entries
// ---------------------------------------------------------------------------

export interface WaitlistEntry {
  id: string
  email: string
  source: string | null
  created_at: string
}

export interface WaitlistEntryInsert {
  id?: string
  email: string
  source?: string | null
  created_at?: string
}

// ---------------------------------------------------------------------------
// Convenience helper types for API responses
// ---------------------------------------------------------------------------

/** Inbox row — ai_reply joined with its parent comment data */
export interface InboxRow extends AiReply {
  comment: Comment
}

/** Usage summary returned by /api/usage */
export interface UsageSummary {
  used: number
  limit: number
  billingPeriodStart: string
  billingPeriodEnd: string | null
  percentUsed: number
}
