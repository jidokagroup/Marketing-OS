-- Client acquisition automations for Pipeline & Money.
--
-- Extends the existing marketing_os_leads table rather than adding a parallel
-- one: leads are already owner- and client-scoped there, already carry
-- attribution back to the content that produced them, and the Pipeline page
-- already renders them. What was missing is the outreach sequence around a
-- lead -- which stage it is at, when the next touch is due, and the history of
-- what was actually sent.
--
-- Additive only.

alter table public.marketing_os_leads
  add column if not exists outreach_stage  text not null default 'Daily Queue',
  add column if not exists next_attempt_at timestamptz,
  add column if not exists linkedin_url    text,
  add column if not exists source_url      text,
  add column if not exists evidence        text;

create index if not exists marketing_os_leads_outreach_due_idx
  on public.marketing_os_leads (owner_id, next_attempt_at)
  where next_attempt_at is not null;

-- One row per touch. The generated body is kept even after sending, so the
-- sequence is auditable and later attempts can avoid repeating themselves.
create table if not exists public.marketing_os_acquisition_attempts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  lead_id       uuid not null references public.marketing_os_leads (id) on delete cascade,
  client_id     uuid references public.marketing_os_clients (id) on delete set null,
  agent_id      uuid references public.marketing_os_writing_agents (id) on delete set null,
  attempt_no    integer not null default 1,
  channel       text not null default 'email'
    check (channel in ('email','linkedin','instagram_dm')),
  subject       text,
  body          text not null,
  status        text not null default 'draft'
    check (status in ('draft','approved','sent','replied','skipped')),
  -- The verification pass's own output: verdict, score, issues it found, and
  -- the message it approved. Kept so a human can see why a draft was held.
  verification  jsonb not null default '{}'::jsonb,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists marketing_os_acquisition_attempts_lead_idx
  on public.marketing_os_acquisition_attempts (lead_id, attempt_no);

-- Attempt numbers are derived by counting existing rows, so two requests that
-- overlap would both read the same count and write the same attempt_no. The
-- constraint makes the loser fail cleanly instead of silently duplicating a
-- touch in the sequence.
create unique index if not exists marketing_os_acquisition_attempts_lead_no_key
  on public.marketing_os_acquisition_attempts (lead_id, attempt_no);

create table if not exists public.marketing_os_acquisition_replies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  lead_id     uuid not null references public.marketing_os_leads (id) on delete cascade,
  attempt_id  uuid references public.marketing_os_acquisition_attempts (id) on delete set null,
  channel     text not null default 'email',
  body        text not null,
  received_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists marketing_os_acquisition_replies_lead_idx
  on public.marketing_os_acquisition_replies (lead_id, received_at desc);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_acquisition_attempts',
    'marketing_os_acquisition_replies'
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

create trigger marketing_os_acquisition_attempts_set_updated_at
  before update on public.marketing_os_acquisition_attempts
  for each row execute function public.marketing_os_set_updated_at();
