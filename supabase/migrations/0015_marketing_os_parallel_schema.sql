-- Jidoka Marketing Team OS parallel schema.
-- Keeps existing brkfree_ tables intact and creates matching marketing_os_ tables, functions, indexes, policies, and storage buckets.

-- Source: supabase/migrations/0011_autom8_prefixed_brkfree_schema.sql
-- Jidoka Marketing Team OS isolated schema inside the existing Autom8 Supabase project.
-- All Jidoka Marketing Team OS app-owned tables use the marketing_os_ prefix to avoid collisions.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.marketing_os_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.marketing_os_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.marketing_os_clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  industry    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.marketing_os_writing_agents (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users (id) on delete cascade,
  client_id         uuid references public.marketing_os_clients (id) on delete set null,
  name              text not null,
  industry          text,
  platform          text,
  notes             text,
  status            text not null default 'draft'
    check (status in ('draft','analyzing','ready','error')),
  last_analyzed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.marketing_os_uploaded_assets (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  kind            text not null default 'paste',
  title           text,
  source_url      text,
  storage_path    text,
  mime_type       text,
  byte_size       bigint,
  extracted_text  text,
  char_count      integer,
  status          text not null default 'pending'
    check (status in ('pending','extracted','error')),
  error           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.marketing_os_uploaded_scripts (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  asset_id     uuid references public.marketing_os_uploaded_assets (id) on delete cascade,
  chunk_index  integer not null default 0,
  content      text not null,
  token_count  integer,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

create table if not exists public.marketing_os_voice_profiles (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id           uuid not null references auth.users (id) on delete cascade,
  tone               jsonb not null default '{}'::jsonb,
  syntax             jsonb not null default '{}'::jsonb,
  formatting         jsonb not null default '{}'::jsonb,
  emotional_profile  jsonb not null default '{}'::jsonb,
  quirks             jsonb not null default '{}'::jsonb,
  fingerprint        jsonb not null default '{}'::jsonb,
  summary            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.marketing_os_belief_profiles (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  core_beliefs         jsonb not null default '[]'::jsonb,
  contrarian_beliefs   jsonb not null default '[]'::jsonb,
  industry_opinions    jsonb not null default '[]'::jsonb,
  philosophies         jsonb not null default '[]'::jsonb,
  decision_frameworks  jsonb not null default '[]'::jsonb,
  summary              text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_hook_libraries (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  hooks       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.marketing_os_story_frameworks (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  frameworks      jsonb not null default '[]'::jsonb,
  emotional_arcs  jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.marketing_os_phrase_libraries (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id         uuid not null references auth.users (id) on delete cascade,
  favorite_words   jsonb not null default '[]'::jsonb,
  favorite_phrases jsonb not null default '[]'::jsonb,
  openers          jsonb not null default '[]'::jsonb,
  closers          jsonb not null default '[]'::jsonb,
  transitions      jsonb not null default '[]'::jsonb,
  metaphors        jsonb not null default '[]'::jsonb,
  ctas             jsonb not null default '[]'::jsonb,
  analogies        jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.marketing_os_knowledge_graphs (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  company       jsonb not null default '{}'::jsonb,
  products      jsonb not null default '[]'::jsonb,
  customers     jsonb not null default '[]'::jsonb,
  competitors   jsonb not null default '[]'::jsonb,
  objections    jsonb not null default '[]'::jsonb,
  testimonials  jsonb not null default '[]'::jsonb,
  brand_assets  jsonb not null default '[]'::jsonb,
  summary       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.marketing_os_generated_content (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  title                text,
  topic                text,
  goal                 text,
  platform             text,
  audience             text,
  offer                text,
  cta                  text,
  length               text,
  notes                text,
  primary_script       text,
  alternate_hooks      jsonb not null default '[]'::jsonb,
  alternate_ctas       jsonb not null default '[]'::jsonb,
  short_version        text,
  long_version         text,
  organic_version      text,
  sales_version        text,
  retrieved_script_ids uuid[] not null default '{}',
  overall_score        numeric,
  below_threshold      boolean not null default false,
  attempts             integer not null default 1,
  model                text,
  created_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_quality_scores (
  id                   uuid primary key default gen_random_uuid(),
  generated_content_id uuid not null references public.marketing_os_generated_content (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  voice_match          numeric,
  syntax_match         numeric,
  hook_match           numeric,
  story_match          numeric,
  belief_match         numeric,
  emotional_match      numeric,
  phrase_match         numeric,
  brand_accuracy       numeric,
  knowledge_accuracy   numeric,
  overall              numeric,
  attempt              integer not null default 1,
  rationale            text,
  created_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_revision_logs (
  id                   uuid primary key default gen_random_uuid(),
  generated_content_id uuid not null references public.marketing_os_generated_content (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  original_text        text,
  edited_text          text,
  published_text       text,
  diff                 jsonb,
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_performance_metrics (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id         uuid not null references auth.users (id) on delete cascade,
  platform         text,
  external_id      text,
  content_excerpt  text,
  metrics          jsonb not null default '{}'::jsonb,
  tier             text,
  captured_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.marketing_os_training_assets (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.marketing_os_brand_brains (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null unique references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  business_name        text,
  industry             text,
  description          text,
  language             text default 'English',
  tone                 text[] not null default '{}',
  tone_notes           text,
  services_products    text,
  pricing              text,
  brand_voice_examples text,
  web_link             text,
  booking_link         text,
  allowed_ctas         text,
  cta_keywords         text[] not null default '{}',
  cta_links            jsonb not null default '[]'::jsonb,
  faqs                 jsonb not null default '[]'::jsonb,
  emoji_allowed        boolean not null default true,
  formality_level      integer not null default 50 check (formality_level between 0 and 100),
  location             text,
  hours                text,
  phone                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_social_accounts (
  id                     uuid primary key default gen_random_uuid(),
  agent_id               uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id               uuid not null references auth.users (id) on delete cascade,
  platform               text not null
    check (platform in ('instagram','facebook','youtube','tiktok','x','linkedin','mailchimp')),
  external_account_id    text,
  username               text,
  profile_picture_url    text,
  access_token_encrypted text,
  page_id                text,
  page_token_encrypted   text,
  token_expires_at       timestamptz,
  status                 text not null default 'pending'
    check (status in ('pending','active','expired','disconnected')),
  connected_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.marketing_os_scheduled_posts (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  generated_content_id uuid references public.marketing_os_generated_content (id) on delete set null,
  social_account_id    uuid references public.marketing_os_social_accounts (id) on delete set null,
  platform             text not null default 'instagram',
  title                text,
  caption              text,
  script               text,
  media_url            text,
  media_path           text,
  content_type         text not null default 'video',
  status               text not null default 'draft'
    check (status in ('draft','scheduled','posting','posted','failed')),
  scheduled_time       timestamptz,
  best_posting_window  text,
  ideal_days           text,
  confidence_score     numeric,
  schedule_reason      text,
  comment_dm_enabled   boolean not null default false,
  comment_auto_reply   text,
  dm_sequence          text,
  source_import        text,
  media_file_name      text,
  posted_at            timestamptz,
  external_post_id     text,
  performance_score    numeric,
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_platform_analytics (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  owner_id            uuid not null references auth.users (id) on delete cascade,
  social_account_id   uuid references public.marketing_os_social_accounts (id) on delete set null,
  scheduled_post_id   uuid references public.marketing_os_scheduled_posts (id) on delete set null,
  platform            text not null default 'instagram',
  post_id             text,
  title               text,
  posted_time         timestamptz,
  fetched_at          timestamptz not null default now(),
  date                date,
  hour                integer,
  day_of_week         text,
  caption             text,
  media_type          text,
  views               integer not null default 0,
  impressions         integer not null default 0,
  reach               integer not null default 0,
  likes               integer not null default 0,
  comments            integer not null default 0,
  shares              integer not null default 0,
  saves               integer not null default 0,
  reposts             integer not null default 0,
  watch_time          numeric not null default 0,
  followers_gained    integer not null default 0,
  engagement_score    integer not null default 0,
  performance_score   integer not null default 0,
  raw_metrics         jsonb,
  created_at          timestamptz not null default now(),
  unique (owner_id, platform, post_id)
);

create table if not exists public.marketing_os_social_intelligence_reports (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users (id) on delete cascade,
  agent_id              uuid references public.marketing_os_writing_agents (id) on delete cascade,
  industry              text not null default 'functional medicine',
  platforms             text[] not null default '{}',
  competitor_accounts   text[] not null default '{}',
  trending_topics       jsonb not null default '[]'::jsonb,
  hooks                 jsonb not null default '[]'::jsonb,
  audios                jsonb not null default '[]'::jsonb,
  content_opportunities jsonb not null default '[]'::jsonb,
  summary               text,
  scanned_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create table if not exists public.marketing_os_workspace_members (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  member_user_id  uuid references auth.users (id) on delete cascade,
  client_id       uuid references public.marketing_os_clients (id) on delete cascade,
  email           text not null,
  display_name    text,
  role            text not null default 'strategist'
    check (role in ('admin','strategist','writer','client')),
  status          text not null default 'invited'
    check (status in ('invited','active','disabled')),
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, email, client_id)
);

create table if not exists public.marketing_os_media_assets (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users (id) on delete cascade,
  client_id         uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id          uuid references public.marketing_os_writing_agents (id) on delete cascade,
  uploaded_asset_id uuid references public.marketing_os_uploaded_assets (id) on delete set null,
  title             text,
  file_name         text not null,
  storage_path      text not null,
  mime_type         text,
  byte_size         bigint,
  media_type        text not null default 'asset'
    check (media_type in ('image','video','carousel','document','asset','other')),
  platform_fit      text[] not null default '{}',
  tags              text[] not null default '{}',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.marketing_os_approval_requests (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  client_id            uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id             uuid references public.marketing_os_writing_agents (id) on delete cascade,
  generated_content_id uuid references public.marketing_os_generated_content (id) on delete cascade,
  scheduled_post_id    uuid references public.marketing_os_scheduled_posts (id) on delete cascade,
  requested_by         uuid references auth.users (id) on delete set null,
  reviewer_email       text,
  reviewer_name        text,
  share_token          text not null unique default encode(gen_random_bytes(24), 'hex'),
  status               text not null default 'pending'
    check (status in ('pending','approved','changes_requested','rejected','expired','cancelled')),
  message              text,
  response_note        text,
  due_at               timestamptz,
  expires_at           timestamptz,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (generated_content_id is not null or scheduled_post_id is not null)
);

create table if not exists public.marketing_os_content_comments (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  client_id            uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id             uuid references public.marketing_os_writing_agents (id) on delete cascade,
  generated_content_id uuid references public.marketing_os_generated_content (id) on delete cascade,
  scheduled_post_id    uuid references public.marketing_os_scheduled_posts (id) on delete cascade,
  approval_request_id  uuid references public.marketing_os_approval_requests (id) on delete cascade,
  author_user_id       uuid references auth.users (id) on delete set null,
  author_email         text,
  author_name          text,
  visibility           text not null default 'internal'
    check (visibility in ('internal','client','public')),
  comment_type         text not null default 'note'
    check (comment_type in ('note','revision_request','approval_note','system')),
  body                 text not null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (generated_content_id is not null or scheduled_post_id is not null or approval_request_id is not null)
);

create table if not exists public.marketing_os_content_status_history (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  client_id            uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id             uuid references public.marketing_os_writing_agents (id) on delete cascade,
  generated_content_id uuid references public.marketing_os_generated_content (id) on delete cascade,
  scheduled_post_id    uuid references public.marketing_os_scheduled_posts (id) on delete cascade,
  from_status          text,
  to_status            text not null,
  actor_user_id        uuid references auth.users (id) on delete set null,
  actor_email          text,
  note                 text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  check (generated_content_id is not null or scheduled_post_id is not null)
);

create table if not exists public.marketing_os_competitor_accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  client_id       uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id        uuid references public.marketing_os_writing_agents (id) on delete cascade,
  platform        text not null
    check (platform in ('instagram','facebook','youtube','tiktok','x','linkedin','website','podcast','other')),
  handle          text not null,
  profile_url     text,
  display_name    text,
  niche           text not null default 'functional medicine',
  scan_enabled    boolean not null default true,
  notes           text,
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, platform, handle, client_id)
);

create table if not exists public.marketing_os_notifications (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  recipient_user_id    uuid references auth.users (id) on delete cascade,
  client_id            uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id             uuid references public.marketing_os_writing_agents (id) on delete cascade,
  scheduled_post_id    uuid references public.marketing_os_scheduled_posts (id) on delete cascade,
  generated_content_id uuid references public.marketing_os_generated_content (id) on delete cascade,
  type                 text not null
    check (type in ('account_disconnected','approval_needed','revision_requested','publish_failed','missing_media','missing_caption','analytics_ready','system')),
  title                text not null,
  body                 text,
  action_href          text,
  priority             text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);

create table if not exists public.marketing_os_integration_events (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references auth.users (id) on delete cascade,
  agent_id          uuid references public.marketing_os_writing_agents (id) on delete cascade,
  social_account_id uuid references public.marketing_os_social_accounts (id) on delete set null,
  scheduled_post_id uuid references public.marketing_os_scheduled_posts (id) on delete set null,
  platform          text not null,
  event_type        text not null
    check (event_type in ('oauth_started','oauth_connected','token_refreshed','token_expired','publish_attempt','publish_success','publish_failed','analytics_pull','webhook','api_error')),
  status            text not null default 'info'
    check (status in ('info','success','warning','error')),
  message           text,
  request_id        text,
  external_id       text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.marketing_os_client_share_links (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  client_id           uuid references public.marketing_os_clients (id) on delete cascade,
  approval_request_id uuid references public.marketing_os_approval_requests (id) on delete cascade,
  token               text not null unique default encode(gen_random_bytes(24), 'hex'),
  label               text,
  scope               text not null default 'approval'
    check (scope in ('approval','calendar','content_library','analytics')),
  permissions         jsonb not null default '{}'::jsonb,
  expires_at          timestamptz,
  last_accessed_at    timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.marketing_os_activity_events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email   text,
  client_id     uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id      uuid references public.marketing_os_writing_agents (id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid,
  event_type    text not null,
  title         text not null,
  body          text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_os_clients_owner_idx on public.marketing_os_clients (owner_id);
create index if not exists marketing_os_writing_agents_owner_idx on public.marketing_os_writing_agents (owner_id);
create index if not exists marketing_os_writing_agents_client_idx on public.marketing_os_writing_agents (client_id);
create index if not exists marketing_os_uploaded_assets_agent_idx on public.marketing_os_uploaded_assets (agent_id);
create index if not exists marketing_os_uploaded_assets_owner_idx on public.marketing_os_uploaded_assets (owner_id);
create index if not exists marketing_os_uploaded_scripts_agent_idx on public.marketing_os_uploaded_scripts (agent_id);
create index if not exists marketing_os_uploaded_scripts_owner_idx on public.marketing_os_uploaded_scripts (owner_id);
create index if not exists marketing_os_uploaded_scripts_embedding_idx
  on public.marketing_os_uploaded_scripts using hnsw (embedding vector_cosine_ops);
create index if not exists marketing_os_generated_content_agent_idx on public.marketing_os_generated_content (agent_id);
create index if not exists marketing_os_generated_content_owner_idx on public.marketing_os_generated_content (owner_id);
create index if not exists marketing_os_quality_scores_content_idx on public.marketing_os_quality_scores (generated_content_id);
create index if not exists marketing_os_revision_logs_content_idx on public.marketing_os_revision_logs (generated_content_id);
create index if not exists marketing_os_performance_metrics_agent_idx on public.marketing_os_performance_metrics (agent_id);
create index if not exists marketing_os_training_assets_agent_idx on public.marketing_os_training_assets (agent_id);
create index if not exists marketing_os_brand_brains_owner_idx on public.marketing_os_brand_brains (owner_id);
create index if not exists marketing_os_social_accounts_agent_idx on public.marketing_os_social_accounts (agent_id);
create index if not exists marketing_os_social_accounts_owner_idx on public.marketing_os_social_accounts (owner_id);
create index if not exists marketing_os_scheduled_posts_agent_idx on public.marketing_os_scheduled_posts (agent_id);
create index if not exists marketing_os_scheduled_posts_owner_idx on public.marketing_os_scheduled_posts (owner_id);
create index if not exists marketing_os_scheduled_posts_due_idx
  on public.marketing_os_scheduled_posts (scheduled_time) where status = 'scheduled';
create index if not exists marketing_os_scheduled_posts_title_idx on public.marketing_os_scheduled_posts (agent_id, title);
create index if not exists marketing_os_platform_analytics_agent_idx on public.marketing_os_platform_analytics (agent_id);
create index if not exists marketing_os_platform_analytics_date_idx on public.marketing_os_platform_analytics (date);
create index if not exists marketing_os_social_intelligence_reports_owner_idx
  on public.marketing_os_social_intelligence_reports (owner_id, scanned_at desc);
create index if not exists marketing_os_workspace_members_owner_idx on public.marketing_os_workspace_members (owner_id);
create index if not exists marketing_os_workspace_members_client_idx on public.marketing_os_workspace_members (client_id);
create index if not exists marketing_os_media_assets_owner_idx on public.marketing_os_media_assets (owner_id, created_at desc);
create index if not exists marketing_os_media_assets_agent_idx on public.marketing_os_media_assets (agent_id);
create index if not exists marketing_os_approval_requests_owner_status_idx on public.marketing_os_approval_requests (owner_id, status, created_at desc);
create index if not exists marketing_os_approval_requests_token_idx on public.marketing_os_approval_requests (share_token);
create index if not exists marketing_os_content_comments_generated_idx on public.marketing_os_content_comments (generated_content_id, created_at);
create index if not exists marketing_os_content_comments_scheduled_idx on public.marketing_os_content_comments (scheduled_post_id, created_at);
create index if not exists marketing_os_content_status_history_generated_idx on public.marketing_os_content_status_history (generated_content_id, created_at desc);
create index if not exists marketing_os_content_status_history_scheduled_idx on public.marketing_os_content_status_history (scheduled_post_id, created_at desc);
create index if not exists marketing_os_competitor_accounts_owner_idx on public.marketing_os_competitor_accounts (owner_id, scan_enabled);
create index if not exists marketing_os_notifications_owner_unread_idx on public.marketing_os_notifications (owner_id, created_at desc) where read_at is null;
create index if not exists marketing_os_integration_events_owner_idx on public.marketing_os_integration_events (owner_id, created_at desc);
create index if not exists marketing_os_client_share_links_token_idx on public.marketing_os_client_share_links (token);
create index if not exists marketing_os_activity_events_owner_idx on public.marketing_os_activity_events (owner_id, created_at desc);

create or replace function public.marketing_os_match_scripts(
  p_agent_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer default 20
)
returns table (
  id uuid,
  asset_id uuid,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.asset_id,
    s.chunk_index,
    s.content,
    1 - (s.embedding <=> p_query_embedding) as similarity
  from public.marketing_os_uploaded_scripts s
  where s.agent_id = p_agent_id
    and s.owner_id = auth.uid()
    and s.embedding is not null
  order by s.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

revoke all on function public.marketing_os_match_scripts(uuid, vector, integer) from public;
grant execute on function public.marketing_os_match_scripts(uuid, vector, integer) to authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_profiles',
    'marketing_os_clients',
    'marketing_os_writing_agents',
    'marketing_os_voice_profiles',
    'marketing_os_belief_profiles',
    'marketing_os_hook_libraries',
    'marketing_os_story_frameworks',
    'marketing_os_phrase_libraries',
    'marketing_os_knowledge_graphs',
    'marketing_os_brand_brains',
    'marketing_os_social_accounts',
    'marketing_os_scheduled_posts',
    'marketing_os_workspace_members',
    'marketing_os_media_assets',
    'marketing_os_approval_requests',
    'marketing_os_content_comments',
    'marketing_os_competitor_accounts',
    'marketing_os_client_share_links'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.marketing_os_set_updated_at();', t);
  end loop;
end;
$$;

alter table public.marketing_os_profiles enable row level security;
drop policy if exists marketing_os_profiles_select on public.marketing_os_profiles;
drop policy if exists marketing_os_profiles_update on public.marketing_os_profiles;
drop policy if exists marketing_os_profiles_insert on public.marketing_os_profiles;
create policy marketing_os_profiles_select on public.marketing_os_profiles
  for select using (id = auth.uid());
create policy marketing_os_profiles_update on public.marketing_os_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy marketing_os_profiles_insert on public.marketing_os_profiles
  for insert with check (id = auth.uid());

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_clients',
    'marketing_os_writing_agents',
    'marketing_os_uploaded_assets',
    'marketing_os_uploaded_scripts',
    'marketing_os_voice_profiles',
    'marketing_os_belief_profiles',
    'marketing_os_hook_libraries',
    'marketing_os_story_frameworks',
    'marketing_os_phrase_libraries',
    'marketing_os_knowledge_graphs',
    'marketing_os_generated_content',
    'marketing_os_quality_scores',
    'marketing_os_revision_logs',
    'marketing_os_performance_metrics',
    'marketing_os_training_assets',
    'marketing_os_brand_brains',
    'marketing_os_social_accounts',
    'marketing_os_scheduled_posts',
    'marketing_os_platform_analytics',
    'marketing_os_social_intelligence_reports',
    'marketing_os_workspace_members',
    'marketing_os_media_assets',
    'marketing_os_approval_requests',
    'marketing_os_content_comments',
    'marketing_os_content_status_history',
    'marketing_os_competitor_accounts',
    'marketing_os_notifications',
    'marketing_os_integration_events',
    'marketing_os_client_share_links',
    'marketing_os_activity_events'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (owner_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_delete on public.%I for delete using (owner_id = auth.uid());', t, t);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values
  ('marketing-os-assets', 'marketing-os-assets', false),
  ('marketing-os-media', 'marketing-os-media', false),
  ('marketing-os-brand-media', 'marketing-os-brand-media', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 524288000
where id = 'marketing-os-media';

drop policy if exists "marketing_os_storage_owner_read" on storage.objects;
drop policy if exists "marketing_os_storage_owner_insert" on storage.objects;
drop policy if exists "marketing_os_storage_owner_update" on storage.objects;
drop policy if exists "marketing_os_storage_owner_delete" on storage.objects;

create policy "marketing_os_storage_owner_read" on storage.objects
  for select using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "marketing_os_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "marketing_os_storage_owner_update" on storage.objects
  for update using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "marketing_os_storage_owner_delete" on storage.objects
  for delete using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Source: supabase/migrations/0012_autom8_brkfree_schema_hardening.sql
alter function public.marketing_os_set_updated_at() set search_path = public;
revoke all on function public.marketing_os_set_updated_at() from public;
revoke all on function public.marketing_os_set_updated_at() from anon;
revoke all on function public.marketing_os_set_updated_at() from authenticated;

alter function public.marketing_os_match_scripts(uuid, vector, integer) security invoker;
alter function public.marketing_os_match_scripts(uuid, vector, integer) set search_path = public;
revoke all on function public.marketing_os_match_scripts(uuid, vector, integer) from public;
revoke all on function public.marketing_os_match_scripts(uuid, vector, integer) from anon;
grant execute on function public.marketing_os_match_scripts(uuid, vector, integer) to authenticated;
grant execute on function public.marketing_os_match_scripts(uuid, vector, integer) to service_role;

do $$
declare
  r record;
begin
  for r in
    with fk as (
      select
        con.conrelid,
        con.conname as constraint_name,
        ns.nspname as schema_name,
        rel.relname as table_name,
        con.conkey as fk_attnums,
        string_agg(format('%I', att.attname), ', ' order by u.ord) as column_list
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join unnest(con.conkey) with ordinality as u(attnum, ord) on true
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = u.attnum
      where con.contype = 'f'
        and ns.nspname = 'public'
        and rel.relname like 'marketing_os_%'
      group by con.conrelid, con.conname, ns.nspname, rel.relname, con.conkey
    ), missing as (
      select fk.*
      from fk
      where not exists (
        select 1
        from pg_index i
        where i.indrelid = fk.conrelid
          and i.indisvalid
          and (
            select array_agg(k order by ord)
            from unnest(i.indkey::smallint[]) with ordinality as keys(k, ord)
            where ord <= array_length(fk.fk_attnums, 1)
          ) = (
            select array_agg(k order by ord)
            from unnest(fk.fk_attnums) with ordinality as keys(k, ord)
          )
      )
    )
    select
      schema_name,
      table_name,
      regexp_replace(constraint_name, '_fkey$', '_idx') as index_name,
      column_list
    from missing
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s);',
      left(r.index_name, 63),
      r.schema_name,
      r.table_name,
      r.column_list
    );
  end loop;
end $$;

drop policy if exists marketing_os_profiles_select on public.marketing_os_profiles;
drop policy if exists marketing_os_profiles_update on public.marketing_os_profiles;
drop policy if exists marketing_os_profiles_insert on public.marketing_os_profiles;
create policy marketing_os_profiles_select on public.marketing_os_profiles
  for select using (id = (select auth.uid()));
create policy marketing_os_profiles_update on public.marketing_os_profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy marketing_os_profiles_insert on public.marketing_os_profiles
  for insert with check (id = (select auth.uid()));

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_clients',
    'marketing_os_writing_agents',
    'marketing_os_uploaded_assets',
    'marketing_os_uploaded_scripts',
    'marketing_os_voice_profiles',
    'marketing_os_belief_profiles',
    'marketing_os_hook_libraries',
    'marketing_os_story_frameworks',
    'marketing_os_phrase_libraries',
    'marketing_os_knowledge_graphs',
    'marketing_os_generated_content',
    'marketing_os_quality_scores',
    'marketing_os_revision_logs',
    'marketing_os_performance_metrics',
    'marketing_os_training_assets',
    'marketing_os_brand_brains',
    'marketing_os_social_accounts',
    'marketing_os_scheduled_posts',
    'marketing_os_platform_analytics',
    'marketing_os_social_intelligence_reports',
    'marketing_os_workspace_members',
    'marketing_os_media_assets',
    'marketing_os_approval_requests',
    'marketing_os_content_comments',
    'marketing_os_content_status_history',
    'marketing_os_competitor_accounts',
    'marketing_os_notifications',
    'marketing_os_integration_events',
    'marketing_os_client_share_links',
    'marketing_os_activity_events'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_delete on public.%I for delete using (owner_id = (select auth.uid()));', t, t);
  end loop;
end;
$$;

drop policy if exists "marketing_os_storage_owner_read" on storage.objects;
drop policy if exists "marketing_os_storage_owner_insert" on storage.objects;
drop policy if exists "marketing_os_storage_owner_update" on storage.objects;
drop policy if exists "marketing_os_storage_owner_delete" on storage.objects;

create policy "marketing_os_storage_owner_read" on storage.objects
  for select using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "marketing_os_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "marketing_os_storage_owner_update" on storage.objects
  for update using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "marketing_os_storage_owner_delete" on storage.objects
  for delete using (
    bucket_id in ('marketing-os-assets','marketing-os-media','marketing-os-brand-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- Source: supabase/migrations/0009_film_sessions.sql
-- ───────────────────────────────────────────────────────────────
-- Jidoka Marketing Team OS — Film Sessions (batch script generator output)
-- A film session is a document of up to 50 scripts across formats,
-- laid out like the reference "Film Session" filming scripts.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.marketing_os_film_sessions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  agent_id       uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  client_id      uuid references public.marketing_os_clients (id) on delete set null,
  title          text not null,
  client_name    text,
  source_material text,
  format_mix     jsonb not null default '[]'::jsonb,   -- [{ formatId, count, topics }]
  scripts        jsonb not null default '[]'::jsonb,   -- GeneratedFilmScript[]
  script_count   integer not null default 0,
  status         text not null default 'ready',        -- generating | ready | error
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists marketing_os_film_sessions_owner_idx on public.marketing_os_film_sessions (owner_id);
create index if not exists marketing_os_film_sessions_agent_idx on public.marketing_os_film_sessions (agent_id);

-- updated_at maintenance (self-contained, no cross-migration dependency)
create or replace function public.marketing_os_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at on public.marketing_os_film_sessions;
create trigger set_updated_at before update on public.marketing_os_film_sessions
  for each row execute function public.marketing_os_touch_updated_at();

-- RLS: owner-scoped
alter table public.marketing_os_film_sessions enable row level security;
drop policy if exists marketing_os_film_sessions_select on public.marketing_os_film_sessions;
drop policy if exists marketing_os_film_sessions_insert on public.marketing_os_film_sessions;
drop policy if exists marketing_os_film_sessions_update on public.marketing_os_film_sessions;
drop policy if exists marketing_os_film_sessions_delete on public.marketing_os_film_sessions;
create policy marketing_os_film_sessions_select on public.marketing_os_film_sessions
  for select using (owner_id = auth.uid());
create policy marketing_os_film_sessions_insert on public.marketing_os_film_sessions
  for insert with check (owner_id = auth.uid());
create policy marketing_os_film_sessions_update on public.marketing_os_film_sessions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy marketing_os_film_sessions_delete on public.marketing_os_film_sessions
  for delete using (owner_id = auth.uid());


-- Source: supabase/migrations/0013_brkfree_inbox_review_tables.sql
-- Jidoka Marketing Team OS client Inbox / human review tables.
-- These tables persist Instagram Comment-to-DM review work separately from the
-- scheduler so inbound comments, AI drafts, approvals, and rejections have a
-- durable audit trail.

create table if not exists public.marketing_os_inbox_threads (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  client_id          uuid references public.marketing_os_clients (id) on delete cascade,
  agent_id           uuid references public.marketing_os_writing_agents (id) on delete cascade,
  social_account_id  uuid references public.marketing_os_social_accounts (id) on delete set null,
  scheduled_post_id  uuid unique references public.marketing_os_scheduled_posts (id) on delete cascade,
  platform           text not null default 'instagram',
  channel            text not null default 'comment'
    check (channel in ('comment','dm')),
  external_thread_id text,
  participant_id     text,
  participant_username text,
  status             text not null default 'needs_review'
    check (status in ('needs_review','approved','rejected','posted','resolved','archived')),
  review_reason      text,
  last_message_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.marketing_os_inbox_messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.marketing_os_inbox_threads (id) on delete cascade,
  owner_id            uuid not null references auth.users (id) on delete cascade,
  role                text not null default 'assistant'
    check (role in ('commenter','user','assistant','ai','human','system')),
  message_type        text not null default 'comment'
    check (message_type in ('comment','public_reply','dm','note','system')),
  body                text not null,
  ai_generated        boolean not null default false,
  status              text not null default 'draft'
    check (status in ('draft','approved','posted','rejected')),
  external_message_id text,
  created_at          timestamptz not null default now()
);

create table if not exists public.marketing_os_inbox_reviews (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references public.marketing_os_inbox_threads (id) on delete cascade,
  owner_id         uuid not null references auth.users (id) on delete cascade,
  reviewer_id      uuid references auth.users (id) on delete set null,
  action           text not null
    check (action in ('approved','rejected','edited','posted','resolved')),
  edited_body      text,
  note             text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists marketing_os_inbox_threads_owner_status_idx
  on public.marketing_os_inbox_threads (owner_id, status, updated_at desc);
create index if not exists marketing_os_inbox_threads_client_idx
  on public.marketing_os_inbox_threads (client_id, updated_at desc);
create index if not exists marketing_os_inbox_threads_agent_idx
  on public.marketing_os_inbox_threads (agent_id, updated_at desc);
create index if not exists marketing_os_inbox_messages_thread_idx
  on public.marketing_os_inbox_messages (thread_id, created_at);
create index if not exists marketing_os_inbox_reviews_thread_idx
  on public.marketing_os_inbox_reviews (thread_id, created_at desc);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_inbox_threads',
    'marketing_os_inbox_messages',
    'marketing_os_inbox_reviews'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_delete on public.%I for delete using (owner_id = (select auth.uid()));', t, t);
  end loop;
end $$;

drop trigger if exists set_updated_at on public.marketing_os_inbox_threads;
create trigger set_updated_at
  before update on public.marketing_os_inbox_threads
  for each row execute function public.marketing_os_set_updated_at();


-- Source: supabase/migrations/0014_brkfree_brand_brain_offers.sql
-- Separate Offers from Services / products in Jidoka Marketing Team OS Brand Brain.

alter table public.marketing_os_brand_brains
  add column if not exists offers text;
