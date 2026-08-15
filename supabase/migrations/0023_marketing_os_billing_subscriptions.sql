-- Stripe subscription state for Jidoka Marketing Team OS billing.
--
-- One row per owner. Stripe is the source of truth for subscription status;
-- this table is a read cache the app can query without calling the Stripe
-- API on every page load. The checkout/portal server actions create and
-- point the owner at a Stripe customer; the /api/webhooks/stripe handler
-- (service-role client, bypasses RLS) is the only writer of subscription
-- status, since Stripe webhook requests carry no Supabase session.

create table if not exists public.marketing_os_billing_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   text
    check (plan in ('monthly', 'annual')),
  status                 text not null default 'none'
    check (status in (
      'none', 'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists marketing_os_billing_subscriptions_owner_idx
  on public.marketing_os_billing_subscriptions (owner_id);
create index if not exists marketing_os_billing_subscriptions_customer_idx
  on public.marketing_os_billing_subscriptions (stripe_customer_id);

alter table public.marketing_os_billing_subscriptions enable row level security;

drop policy if exists marketing_os_billing_subscriptions_select
  on public.marketing_os_billing_subscriptions;
drop policy if exists marketing_os_billing_subscriptions_insert
  on public.marketing_os_billing_subscriptions;
drop policy if exists marketing_os_billing_subscriptions_update
  on public.marketing_os_billing_subscriptions;

-- Owners can read their own row. Insert/update from the app is limited to
-- the find-or-create-customer step in the checkout action; real status
-- transitions (trialing -> active -> canceled, etc.) only ever come from
-- the Stripe webhook via the service-role client, which bypasses RLS.
create policy marketing_os_billing_subscriptions_select
  on public.marketing_os_billing_subscriptions
  for select using (owner_id = (select auth.uid()));

create policy marketing_os_billing_subscriptions_insert
  on public.marketing_os_billing_subscriptions
  for insert with check (owner_id = (select auth.uid()));

create policy marketing_os_billing_subscriptions_update
  on public.marketing_os_billing_subscriptions
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop trigger if exists set_updated_at
  on public.marketing_os_billing_subscriptions;
create trigger set_updated_at
  before update on public.marketing_os_billing_subscriptions
  for each row execute function public.marketing_os_set_updated_at();

comment on table public.marketing_os_billing_subscriptions is
  'Read cache of Stripe subscription state, one row per owner. Stripe webhook is the only writer of status/plan/period fields.';
comment on column public.marketing_os_billing_subscriptions.status is
  'Mirrors Stripe Subscription.status verbatim, plus none for an owner who never started checkout.';
