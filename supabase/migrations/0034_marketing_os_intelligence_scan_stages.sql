-- Turns a competitor scan from one long call into resumable, inspectable work.
--
-- A scan used to be a single function invocation that fetched every source,
-- ran a web-search pass, and asked one model call for thirteen sections of
-- analysis. Everything shared one timeout, so ten minutes of successful
-- fetching was discarded when the last step ran long, and there was no record
-- of what had been done — a stuck scan looked identical to a slow one.
--
-- These columns and tables let each stage bank its own result, so a retry
-- resumes instead of restarting, a partly-successful scan can still produce a
-- report, and a failure can say which step failed without exposing any of it
-- to the customer. Purely additive.

alter table if exists public.marketing_os_social_intelligence_reports
  add column if not exists current_stage          text,
  add column if not exists sources_total          integer not null default 0,
  add column if not exists sources_completed      integer not null default 0,
  add column if not exists sources_failed         integer not null default 0,
  add column if not exists percent_complete       integer not null default 0,
  add column if not exists last_completed_step    text,
  add column if not exists started_at             timestamptz,
  add column if not exists completed_at           timestamptz,
  add column if not exists retry_count            integer not null default 0,
  add column if not exists error_code             text,
  -- Kept apart from `error_message`, which is the sentence the customer sees.
  -- This one holds the provider's own words and never reaches the UI.
  add column if not exists internal_error_message text;

-- The status vocabulary grows from four values to the full job lifecycle.
-- Dropped and re-added rather than altered because a check constraint cannot
-- be widened in place.
alter table if exists public.marketing_os_social_intelligence_reports
  drop constraint if exists marketing_os_social_intelligence_reports_status_check;

alter table if exists public.marketing_os_social_intelligence_reports
  add constraint marketing_os_social_intelligence_reports_status_check
  check (status in (
    'queued',
    'fetching',
    'normalizing',
    'analyzing',
    'aggregating',
    'generating_recommendations',
    'running',      -- retained: rows written before this migration still use it
    'complete',
    'partial',
    'failed',
    'cancelled'
  ));

-- One row per stage per scan. This is what makes a retry resumable: the worker
-- asks which stages already succeeded rather than starting over.
create table if not exists public.marketing_os_intelligence_scan_stages (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  report_id     uuid not null references public.marketing_os_social_intelligence_reports (id) on delete cascade,
  stage         text not null,
  status        text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  attempts      integer not null default 0,
  -- What the stage produced, so the next stage reads a banked result rather
  -- than recomputing it.
  output        jsonb not null default '{}'::jsonb,
  error_code    text,
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (report_id, stage)
);

create index if not exists marketing_os_intelligence_scan_stages_report_idx
  on public.marketing_os_intelligence_scan_stages (report_id, stage);

-- One row per competitor source. Lets the page say "7 of 18" honestly, and
-- lets a scan finish as `partial` naming which sources it could not read.
create table if not exists public.marketing_os_intelligence_scan_sources (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  report_id     uuid not null references public.marketing_os_social_intelligence_reports (id) on delete cascade,
  source_url    text not null,
  platform      text,
  status        text not null default 'pending'
    check (status in ('pending', 'fetched', 'analyzed', 'failed', 'skipped')),
  attempts      integer not null default 0,
  -- The normalized reading of this one source, small enough that aggregation
  -- works from summaries instead of re-reading raw pages.
  summary       jsonb not null default '{}'::jsonb,
  error_code    text,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (report_id, source_url)
);

create index if not exists marketing_os_intelligence_scan_sources_report_idx
  on public.marketing_os_intelligence_scan_sources (report_id, status);

-- Internal only. Never rendered in the customer UI; this is what makes a
-- failure diagnosable without putting a provider's error on screen.
create table if not exists public.marketing_os_intelligence_scan_logs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  report_id    uuid not null references public.marketing_os_social_intelligence_reports (id) on delete cascade,
  client_id    uuid references public.marketing_os_clients (id) on delete set null,
  stage        text,
  provider     text,
  level        text not null default 'info'
    check (level in ('debug', 'info', 'warn', 'error')),
  latency_ms   integer,
  input_tokens integer,
  output_tokens integer,
  retry_count  integer not null default 0,
  message      text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists marketing_os_intelligence_scan_logs_report_idx
  on public.marketing_os_intelligence_scan_logs (report_id, created_at desc);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_intelligence_scan_stages',
    'marketing_os_intelligence_scan_sources',
    'marketing_os_intelligence_scan_logs'
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

drop trigger if exists marketing_os_intelligence_scan_stages_set_updated_at
  on public.marketing_os_intelligence_scan_stages;
create trigger marketing_os_intelligence_scan_stages_set_updated_at
  before update on public.marketing_os_intelligence_scan_stages
  for each row execute function public.marketing_os_set_updated_at();

drop trigger if exists marketing_os_intelligence_scan_sources_set_updated_at
  on public.marketing_os_intelligence_scan_sources;
create trigger marketing_os_intelligence_scan_sources_set_updated_at
  before update on public.marketing_os_intelligence_scan_sources
  for each row execute function public.marketing_os_set_updated_at();

comment on table public.marketing_os_intelligence_scan_stages is
  'Per-stage progress for a competitor scan, so a retry resumes instead of restarting.';
comment on table public.marketing_os_intelligence_scan_sources is
  'Per-source outcome for a competitor scan, so a partly-successful scan still produces a report.';
comment on table public.marketing_os_intelligence_scan_logs is
  'Internal diagnostics for a competitor scan. Never rendered in the customer UI.';
