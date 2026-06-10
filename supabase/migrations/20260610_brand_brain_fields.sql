-- ============================================================
-- Ensure every Brand Brain field used by the agents exists.
-- Idempotent: safe to run multiple times.
-- ============================================================

ALTER TABLE brand_profiles
  -- Core brand content
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS services_products text,
  ADD COLUMN IF NOT EXISTS pricings text,
  ADD COLUMN IF NOT EXISTS brand_voice_examples text,
  ADD COLUMN IF NOT EXISTS web_link text,
  ADD COLUMN IF NOT EXISTS booking_link text,
  ADD COLUMN IF NOT EXISTS faq_1 text,
  ADD COLUMN IF NOT EXISTS faq_2 text,
  ADD COLUMN IF NOT EXISTS faq_3 text,
  ADD COLUMN IF NOT EXISTS allowed_ctas text,
  ADD COLUMN IF NOT EXISTS cta_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS escalation_rules text,
  ADD COLUMN IF NOT EXISTS emoji_allowed boolean NOT NULL DEFAULT true,
  -- Multi-link CTA picker (AI selects the right link by context)
  ADD COLUMN IF NOT EXISTS cta_links jsonb NOT NULL DEFAULT '[]',
  -- DM automation
  ADD COLUMN IF NOT EXISTS dm_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_trigger_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dm_trigger_mode text NOT NULL DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS dm_template text,
  -- Instagram linkage
  ADD COLUMN IF NOT EXISTS ig_business_id text,
  ADD COLUMN IF NOT EXISTS ig_username text;
