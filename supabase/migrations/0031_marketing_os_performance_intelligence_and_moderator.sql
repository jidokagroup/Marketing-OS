-- Backs three new Jidoka module surfaces, each a schema + prompt + page over
-- data that already existed: Performance Intelligence, the Paid Ads
-- Generator, and Inbox Moderator's per-agent settings. Purely additive.

create table if not exists public.marketing_os_performance_intelligence_reports (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  agent_id            uuid references public.marketing_os_writing_agents (id) on delete cascade,
  post_count          integer not null default 0,
  top_tier_pattern    text,
  bottom_tier_pattern text,
  best_hooks          jsonb not null default '[]'::jsonb,
  best_ctas           jsonb not null default '[]'::jsonb,
  best_formats        jsonb not null default '[]'::jsonb,
  recommendations     jsonb not null default '[]'::jsonb,
  summary             text,
  created_at          timestamptz not null default now()
);

create index if not exists marketing_os_performance_intelligence_reports_agent_idx
  on public.marketing_os_performance_intelligence_reports (agent_id, created_at desc);

create table if not exists public.marketing_os_paid_ad_copy (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  agent_id      uuid references public.marketing_os_writing_agents (id) on delete cascade,
  source_posts  jsonb not null default '[]'::jsonb,
  ads           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_os_paid_ad_copy_agent_idx
  on public.marketing_os_paid_ad_copy (agent_id, created_at desc);

create table if not exists public.marketing_os_inbox_moderator_settings (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users (id) on delete cascade,
  agent_id               uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  enabled                boolean not null default false,
  auto_approve_low_risk  boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (owner_id, agent_id)
);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_performance_intelligence_reports',
    'marketing_os_paid_ad_copy',
    'marketing_os_inbox_moderator_settings'
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

create trigger marketing_os_inbox_moderator_settings_set_updated_at
  before update on public.marketing_os_inbox_moderator_settings
  for each row execute function public.marketing_os_set_updated_at();
