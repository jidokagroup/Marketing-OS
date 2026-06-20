-- Admin accounts: people request access, the superadmin (TDong1919@gmail.com)
-- approves. Approved admins can access the Collab Admin portal.
-- Plus a deliverable_status on collab applications for tracking influencers.
-- Applied to production via MCP.
create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  requested_reason text,
  reviewed_at timestamptz,
  reviewed_by text
);
create index if not exists idx_admin_accounts_status on public.admin_accounts (status);
alter table public.admin_accounts enable row level security;

alter table public.collab_applications
  add column if not exists deliverable_status text not null default 'pending'
    check (deliverable_status in ('pending','posted','complete','missed'));
