-- Attribution of new signups to a collaborator's referral code.
-- Applied to production via MCP apply_migration.
create table if not exists public.collab_referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  referral_code text not null,
  referred_user_id uuid unique references auth.users(id) on delete cascade,
  referred_email text
);

create index if not exists idx_collab_referrals_code on public.collab_referrals (referral_code);

-- All reads/writes go through the service role (which bypasses RLS); enabling
-- RLS with no policy denies anon/authenticated direct access.
alter table public.collab_referrals enable row level security;
