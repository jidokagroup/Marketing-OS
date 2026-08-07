-- Adds a flexible email provider layer for user/client marketing emails.
-- Mailchimp remains supported, but it is now one selectable provider instead
-- of the only email campaign option in Jidoka Marketing Team OS.

create or replace function public.marketing_os_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.marketing_os_email_provider_settings (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  organization_id      uuid not null references auth.users (id) on delete cascade,
  provider             text not null default 'resend'
    check (provider in (
      'mailchimp',
      'google_workspace',
      'resend',
      'custom_smtp',
      'hubspot',
      'klaviyo',
      'activecampaign',
      'constant_contact',
      'custom_api'
    )),
  provider_label       text not null default 'Resend',
  status               text not null default 'needs_setup'
    check (status in ('not_connected','needs_setup','connected','planned')),
  from_name            text,
  from_email           text,
  reply_to_email       text,
  custom_provider_name text,
  notes                text,
  config               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists marketing_os_email_provider_settings_owner_idx
  on public.marketing_os_email_provider_settings (owner_id, provider);

alter table public.marketing_os_email_provider_settings enable row level security;

drop policy if exists marketing_os_email_provider_settings_select
  on public.marketing_os_email_provider_settings;
drop policy if exists marketing_os_email_provider_settings_insert
  on public.marketing_os_email_provider_settings;
drop policy if exists marketing_os_email_provider_settings_update
  on public.marketing_os_email_provider_settings;
drop policy if exists marketing_os_email_provider_settings_delete
  on public.marketing_os_email_provider_settings;

create policy marketing_os_email_provider_settings_select
  on public.marketing_os_email_provider_settings
  for select using (owner_id = (select auth.uid()));

create policy marketing_os_email_provider_settings_insert
  on public.marketing_os_email_provider_settings
  for insert with check (
    owner_id = (select auth.uid())
    and organization_id = (select auth.uid())
  );

create policy marketing_os_email_provider_settings_update
  on public.marketing_os_email_provider_settings
  for update using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and organization_id = (select auth.uid())
  );

create policy marketing_os_email_provider_settings_delete
  on public.marketing_os_email_provider_settings
  for delete using (owner_id = (select auth.uid()));

drop trigger if exists set_updated_at
  on public.marketing_os_email_provider_settings;
create trigger set_updated_at
  before update on public.marketing_os_email_provider_settings
  for each row execute function public.marketing_os_set_updated_at();

comment on table public.marketing_os_email_provider_settings is
  'Workspace-level provider choice for user/client marketing emails.';
