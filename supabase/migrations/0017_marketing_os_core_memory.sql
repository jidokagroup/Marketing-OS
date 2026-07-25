-- Jidoka Marketing Team OS — Core agent training and orchestrator memory.
-- Additive only. Existing marketing_os_* records, routes, and brkfree_* tables remain intact.

create table if not exists public.marketing_os_core_agent_training (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  organization_id  uuid not null references auth.users (id) on delete cascade,
  agent_key        text not null
    check (agent_key in ('growth-revenue','client-delivery','success-intelligence','business-operations')),
  user_facing_name text not null,
  segment          text not null,
  systems          text[] not null default '{}',
  training_data    jsonb not null default '{}'::jsonb,
  operating_rules  text,
  approval_rules   text,
  handoff_rules    text,
  data_sources     text,
  status           text not null default 'active'
    check (status in ('active','draft','archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, agent_key)
);

create table if not exists public.marketing_os_core_chat_threads (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references auth.users (id) on delete cascade,
  title           text not null default 'Orchestrator chat',
  status          text not null default 'active'
    check (status in ('active','archived','escalated')),
  page_path       text,
  agent_context   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.marketing_os_core_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.marketing_os_core_chat_threads (id) on delete cascade,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  body            text not null,
  page_path       text,
  intent          text,
  route_to_agent  text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.marketing_os_memory_records (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users (id) on delete cascade,
  organization_id           uuid not null references auth.users (id) on delete cascade,
  record_type               text not null,
  title                     text not null,
  information               text not null,
  source                    text not null default 'JIDOKA Core',
  source_record_id          uuid,
  memory_owner              text,
  confidence_level          text not null default 'User Confirmed'
    check (confidence_level in ('Verified','User Confirmed','System Confirmed','Probable','Assumption','Unverified')),
  affected_business_systems text[] not null default '{}',
  review_date               date,
  supersedes                uuid references public.marketing_os_memory_records (id) on delete set null,
  status                    text not null default 'active'
    check (status in ('active','superseded','archived','draft')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.marketing_os_agent_handoffs (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users (id) on delete cascade,
  organization_id           uuid not null references auth.users (id) on delete cascade,
  originating_agent         text not null,
  receiving_agent           text not null,
  business_objective        text not null,
  primary_business_system   text,
  affected_business_systems text[] not null default '{}',
  context                   text,
  evidence_source           text,
  action_required           text,
  priority                  text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  deadline                  timestamptz,
  dependencies              text,
  approval_required         text,
  success_criteria          text,
  risks                     text,
  status                    text not null default 'New'
    check (status in ('New','Needs Clarification','Planned','Awaiting Approval','In Progress','Blocked','Under Review','Completed','Monitoring','Escalated','Cancelled')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.marketing_os_developer_requests (
  id                         uuid primary key default gen_random_uuid(),
  owner_id                   uuid not null references auth.users (id) on delete cascade,
  organization_id            uuid not null references auth.users (id) on delete cascade,
  subject                    text not null,
  priority                   text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  affected_agent             text,
  affected_business_systems  text[] not null default '{}',
  current_behavior           text,
  expected_behavior          text,
  business_impact            text,
  evidence                   text,
  reproduction_steps         text,
  proposed_solution          text,
  temporary_workaround       text,
  security_or_compliance     text,
  status                     text not null default 'Awaiting External Submission'
    check (status in ('Awaiting External Submission','Queued','Sent','In Progress','Resolved','Cancelled')),
  created_from_thread_id     uuid references public.marketing_os_core_chat_threads (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists marketing_os_core_agent_training_owner_idx
  on public.marketing_os_core_agent_training (owner_id, agent_key);
create index if not exists marketing_os_core_chat_threads_owner_idx
  on public.marketing_os_core_chat_threads (owner_id, updated_at desc);
create index if not exists marketing_os_core_chat_messages_thread_idx
  on public.marketing_os_core_chat_messages (thread_id, created_at);
create index if not exists marketing_os_memory_records_owner_idx
  on public.marketing_os_memory_records (owner_id, record_type, status, updated_at desc);
create index if not exists marketing_os_agent_handoffs_owner_status_idx
  on public.marketing_os_agent_handoffs (owner_id, status, updated_at desc);
create index if not exists marketing_os_developer_requests_owner_status_idx
  on public.marketing_os_developer_requests (owner_id, status, updated_at desc);

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_core_agent_training',
    'marketing_os_core_chat_threads',
    'marketing_os_core_chat_messages',
    'marketing_os_memory_records',
    'marketing_os_agent_handoffs',
    'marketing_os_developer_requests'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (owner_id = (select auth.uid()));', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = (select auth.uid()) and organization_id = (select auth.uid()));', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and organization_id = (select auth.uid()));', t, t);
    execute format('create policy %I_delete on public.%I for delete using (owner_id = (select auth.uid()));', t, t);
  end loop;
end $$;

do $$
declare
  t text;
  tables text[] := array[
    'marketing_os_core_agent_training',
    'marketing_os_core_chat_threads',
    'marketing_os_memory_records',
    'marketing_os_agent_handoffs',
    'marketing_os_developer_requests'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.marketing_os_set_updated_at();',
      t
    );
  end loop;
end $$;

comment on table public.marketing_os_core_agent_training is
  'User-editable training context for the four JIDOKA Core specialist agents.';
comment on table public.marketing_os_core_chat_messages is
  'Durable orchestrator chat memory for the floating Help guide.';
comment on table public.marketing_os_developer_requests is
  'Refinement and engineering requests created when JIDOKA Core cannot complete a workflow autonomously.';
