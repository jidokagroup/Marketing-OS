-- Contact details and marketing consent captured at signup.
--
-- Two tables on purpose:
--
--   marketing_os_contact_profiles  — current state. One row per owner, holds
--     the phone number and the live opt-in flags. This is what the app reads
--     before sending anything, and what a later preference change updates.
--
--   marketing_os_consent_events    — append-only log. One row every time
--     consent is given or withdrawn, storing the exact wording shown, the
--     timestamp, and the IP and user agent it was submitted from.
--
-- The log is the part that matters if consent is ever challenged. Under TCPA
-- (SMS) and CAN-SPAM/CASL (email) the defensible record is not "this box is
-- currently ticked" — it is what the person was shown, when, and from where.
-- A mutable flag cannot answer that, so it never overwrites history here.

create table if not exists public.marketing_os_contact_profiles (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  full_name      text,
  email          text,
  phone          text,
  email_opt_in   boolean not null default false,
  sms_opt_in     boolean not null default false,
  -- When each channel was last consented to, so a stale opt-in is visible.
  email_opt_in_at timestamptz,
  sms_opt_in_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists marketing_os_contact_profiles_owner_idx
  on public.marketing_os_contact_profiles (owner_id);

create table if not exists public.marketing_os_consent_events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  -- Which channel this record is about.
  channel       text not null check (channel in ('email', 'sms')),
  -- true = opted in, false = withdrawn. Never updated in place.
  granted       boolean not null,
  -- The address or number the consent was given for, as entered.
  contact_value text,
  -- Verbatim copy of the checkbox label the person agreed to. Stored rather
  -- than referenced so that later edits to the signup form cannot rewrite
  -- what a past signup is recorded as having agreed to.
  consent_text  text not null,
  -- Where it happened, e.g. 'signup_form'.
  source        text not null default 'signup_form',
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_os_consent_events_owner_idx
  on public.marketing_os_consent_events (owner_id, created_at desc);
create index if not exists marketing_os_consent_events_channel_idx
  on public.marketing_os_consent_events (channel, granted);

alter table public.marketing_os_contact_profiles enable row level security;
alter table public.marketing_os_consent_events enable row level security;

drop policy if exists marketing_os_contact_profiles_select
  on public.marketing_os_contact_profiles;
drop policy if exists marketing_os_contact_profiles_insert
  on public.marketing_os_contact_profiles;
drop policy if exists marketing_os_contact_profiles_update
  on public.marketing_os_contact_profiles;
drop policy if exists marketing_os_consent_events_select
  on public.marketing_os_consent_events;
drop policy if exists marketing_os_consent_events_insert
  on public.marketing_os_consent_events;

create policy marketing_os_contact_profiles_select
  on public.marketing_os_contact_profiles
  for select using (owner_id = (select auth.uid()));

create policy marketing_os_contact_profiles_insert
  on public.marketing_os_contact_profiles
  for insert with check (owner_id = (select auth.uid()));

create policy marketing_os_contact_profiles_update
  on public.marketing_os_contact_profiles
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy marketing_os_consent_events_select
  on public.marketing_os_consent_events
  for select using (owner_id = (select auth.uid()));

-- Insert only, never update or delete: an audit log that can be edited is
-- not an audit log. No update/delete policy is defined, so RLS denies both
-- to the app; admin cleanup still goes through the service role.
create policy marketing_os_consent_events_insert
  on public.marketing_os_consent_events
  for insert with check (owner_id = (select auth.uid()));

drop trigger if exists set_updated_at
  on public.marketing_os_contact_profiles;
create trigger set_updated_at
  before update on public.marketing_os_contact_profiles
  for each row execute function public.marketing_os_set_updated_at();

comment on table public.marketing_os_contact_profiles is
  'Current contact details and marketing opt-in state, one row per owner.';
comment on table public.marketing_os_consent_events is
  'Append-only consent audit log. Stores the exact wording agreed to, plus IP and user agent, for TCPA/CAN-SPAM evidence.';
comment on column public.marketing_os_consent_events.consent_text is
  'Verbatim checkbox wording shown at the time, so later form edits cannot rewrite historical consent.';
