-- Records what an analytics backfill actually did, per account.
--
-- The import ran, redirected with three totals in the URL, and left no trace.
-- A refresh lost the result, "0 rows" could not be told apart from "the
-- platform refused the request", and an account that had never been attempted
-- looked identical to one that had failed every time. Purely additive.

create table if not exists public.marketing_os_analytics_backfill_runs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  agent_id           uuid references public.marketing_os_writing_agents (id) on delete set null,
  -- The platform asked for, or 'all'. Not constrained to the platform enum
  -- because 'all' is a legitimate request and new platforms should not need a
  -- migration here before they can be backfilled.
  platform           text not null default 'all',
  lookback_days      integer not null default 90,
  status             text not null default 'succeeded'
    check (status in ('running', 'succeeded', 'failed')),
  accounts_processed integer not null default 0,
  rows_stored        integer not null default 0,
  errors             integer not null default 0,
  -- One entry per account: platform, username, rows, status, error.
  detail             jsonb not null default '[]'::jsonb,
  error_message      text,
  requested_at       timestamptz not null default now(),
  finished_at        timestamptz
);

create index if not exists marketing_os_analytics_backfill_runs_owner_idx
  on public.marketing_os_analytics_backfill_runs (owner_id, requested_at desc);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_analytics_backfill_runs'
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

comment on table public.marketing_os_analytics_backfill_runs is
  'History of analytics backfills, with a per-account outcome so a failed import explains itself.';
