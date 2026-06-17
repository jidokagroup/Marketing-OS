-- ============================================================
-- Agent infrastructure tables for Autom8 SaaS
-- ============================================================

-- Add DM/automation fields to brand_profiles
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS dm_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_trigger_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dm_trigger_mode text NOT NULL DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS ig_username text,
  ADD COLUMN IF NOT EXISTS ig_profile_picture_url text;

-- Add page_token to social_accounts (encrypted)
ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS page_token_encrypted text,
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- ============================================================
-- content_queue — one row per scheduled post, per user
-- ============================================================
CREATE TABLE IF NOT EXISTS content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'instagram',
  status text NOT NULL DEFAULT 'queued',  -- queued | scheduled | posted | failed
  media_url text,
  caption text,
  content_type text,          -- image | reel | carousel | story
  title text,
  script text,
  -- AI analysis fields (from n8n workflow)
  emotional_tone text,
  hook_strength text,
  authority_level text,
  engagement_prediction text,
  best_posting_window text,
  ideal_days text,
  virality_probability text,
  recommended_platform_priority text,
  -- scheduling
  scheduled_time timestamptz,
  schedule_reason text,
  confidence_score numeric,
  -- publish outcome
  posted_at timestamptz,
  ig_media_id text,
  performance_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own content" ON content_queue
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_content_queue_user_status ON content_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled ON content_queue(scheduled_time) WHERE status = 'scheduled';

-- ============================================================
-- platform_analytics — normalized analytics per post/day
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'instagram',
  post_id text,                -- external IG/FB media ID
  posted_time timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  date date,
  hour integer,
  day_of_week text,
  caption text,
  media_type text,
  views integer DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  reposts integer DEFAULT 0,
  watch_time numeric DEFAULT 0,
  subscribers_gained integer DEFAULT 0,
  followers_gained integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  performance_score integer DEFAULT 0,
  raw_metrics jsonb,
  UNIQUE(user_id, platform, post_id)
);

ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own analytics" ON platform_analytics
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_analytics_user_platform ON platform_analytics(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON platform_analytics(date);

-- ============================================================
-- dm_conversations — IG DM chatbot state per user+sender
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  recipient_ig_id text NOT NULL,       -- the person DMing us
  recipient_username text,
  conversation_stage text DEFAULT 'active',  -- active | escalated | resolved
  message_count integer DEFAULT 0,
  clarification_attempts integer DEFAULT 0,
  history jsonb NOT NULL DEFAULT '[]',  -- [{role, content, ts}]
  last_message_at timestamptz,
  handoff_reason text,
  trigger_source text,  -- 'comment_keyword' | 'direct_dm' | 'story_reply'
  matched_keyword text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipient_ig_id)
);

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own DMs" ON dm_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dm_user ON dm_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON dm_conversations(user_id, recipient_ig_id);

-- ============================================================
-- comment_processing_log — deduplication (replaces n8n DataTable)
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_business_id text NOT NULL,
  comment_id text NOT NULL,
  comment_text text,
  reply_status text DEFAULT 'processing',  -- processing | replied | skipped | failed
  reply_id text,
  response_text text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ig_business_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_log_lookup ON comment_processing_log(ig_business_id, comment_id);

-- ============================================================
-- Update usage_events to track DM events too
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'dm_sent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'usage_event_type')
  ) THEN
    ALTER TYPE usage_event_type ADD VALUE 'dm_sent';
  END IF;
END$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_content_queue_updated_at') THEN
    CREATE TRIGGER set_content_queue_updated_at
      BEFORE UPDATE ON content_queue
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_dm_conversations_updated_at') THEN
    CREATE TRIGGER set_dm_conversations_updated_at
      BEFORE UPDATE ON dm_conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END$$;
