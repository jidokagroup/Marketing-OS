-- What the system has learned about how a client wants to sound.
--
-- Brand Brain is built once from published work and then re-read on every
-- generation. Everything discovered afterwards — the phrase a client strikes
-- out of every draft, the hook style that outperforms, the CTA length that
-- converts — was being discarded, so the same correction had to be made again
-- next week and the product got no better the longer it was used.
--
-- These are kept separate from the Voice DNA profiles on purpose. A profile is
-- an analysis of what the client already published; a learning is a decision
-- someone made or a pattern performance proved, and it has to stay visible,
-- attributable and reversible. Brand Brain never silently rewrites itself.
-- Purely additive.

create table if not exists public.marketing_os_brand_learnings (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  agent_id            uuid not null references public.marketing_os_writing_agents (id) on delete cascade,
  client_id           uuid references public.marketing_os_clients (id) on delete set null,

  -- The learning itself, written as an instruction a writer could follow.
  statement           text not null,
  -- What kind of preference this is, so the generator can weight and group it.
  kind                text not null default 'other'
    check (kind in (
      'terminology',
      'prohibited_phrase',
      'cta_style',
      'emoji',
      'length',
      'voice_pattern',
      'positioning',
      'format',
      'other'
    )),

  -- Where it came from. Kept precise rather than collapsed into a boolean,
  -- because "the client struck this out twice" and "this outperformed across
  -- twelve posts" carry different weight and deserve different wording.
  source              text not null default 'manual'
    check (source in (
      'manual',
      'user_edit',
      'client_edit',
      'rejected_draft',
      'approved_draft',
      'publishing_performance',
      'revenue_attribution',
      'campaign_result',
      'performance_intelligence'
    )),
  -- The brief's manual-vs-performance split, derived from source but stored so
  -- it can be filtered on without the app knowing the source taxonomy.
  origin              text not null default 'manual'
    check (origin in ('manual', 'performance')),

  -- 0..1. Low confidence learnings still show, worded as observations rather
  -- than rules, so a single data point never masquerades as a finding.
  confidence          numeric(3,2) not null default 0.5
    check (confidence >= 0 and confidence <= 1),
  supporting_examples integer not null default 1,
  -- What it was learned from: post ids, edit diffs, report ids. Enough to
  -- answer "why does it think this?" without re-deriving it.
  evidence            jsonb not null default '{}'::jsonb,

  -- Inactive learnings are kept, not deleted: turning one off is a decision
  -- worth being able to reverse, and its evidence stays useful.
  active              boolean not null default true,
  learned_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists marketing_os_brand_learnings_agent_idx
  on public.marketing_os_brand_learnings (agent_id, active, confidence desc);

-- The same lesson learned twice is one lesson with more evidence behind it,
-- not two rules for a writer to reconcile. Case- and space-insensitive so
-- "No emojis" and "no  emojis" collide as they should.
create unique index if not exists marketing_os_brand_learnings_statement_key
  on public.marketing_os_brand_learnings (
    agent_id,
    lower(regexp_replace(statement, '\s+', ' ', 'g'))
  );

alter table public.marketing_os_brand_learnings enable row level security;

drop policy if exists marketing_os_brand_learnings_select on public.marketing_os_brand_learnings;
drop policy if exists marketing_os_brand_learnings_insert on public.marketing_os_brand_learnings;
drop policy if exists marketing_os_brand_learnings_update on public.marketing_os_brand_learnings;
drop policy if exists marketing_os_brand_learnings_delete on public.marketing_os_brand_learnings;

create policy marketing_os_brand_learnings_select on public.marketing_os_brand_learnings
  for select using (owner_id = (select auth.uid()));
create policy marketing_os_brand_learnings_insert on public.marketing_os_brand_learnings
  for insert with check (owner_id = (select auth.uid()));
create policy marketing_os_brand_learnings_update on public.marketing_os_brand_learnings
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy marketing_os_brand_learnings_delete on public.marketing_os_brand_learnings
  for delete using (owner_id = (select auth.uid()));

drop trigger if exists marketing_os_brand_learnings_set_updated_at
  on public.marketing_os_brand_learnings;
create trigger marketing_os_brand_learnings_set_updated_at
  before update on public.marketing_os_brand_learnings
  for each row execute function public.marketing_os_set_updated_at();

comment on table public.marketing_os_brand_learnings is
  'Preferences and patterns learned after Voice DNA was built. Read on every generation; never written silently.';
