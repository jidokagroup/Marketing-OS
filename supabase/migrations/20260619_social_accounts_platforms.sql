-- The platform CHECK constraint only allowed 'instagram' and 'facebook', so
-- connecting YouTube (and X via OAuth) failed at the DB level ("save_failed").
-- Allow all supported platforms. Applied to production via MCP.
alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
alter table public.social_accounts add constraint social_accounts_platform_check
  check (platform = any (array['instagram','facebook','x','youtube']));
