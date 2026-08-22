-- Makes publishing safe to retry, and safe to run twice.
--
-- Two faults in the publisher motivated this. It claimed due posts with a
-- plain `select ... where status = 'scheduled'` and then updated them, so two
-- overlapping runs could both claim the same row and publish it twice. And
-- nothing ever reclaimed a row left in `posting` by a worker that died
-- mid-publish, so such a post showed "Publishing" forever with nobody able to
-- say whether it had actually gone out.
--
-- These columns let a claim be conditional, an attempt be counted, and a
-- stranded row be told apart from a genuinely in-flight one. Purely additive.

alter table if exists public.marketing_os_scheduled_posts
  add column if not exists attempts          integer not null default 0,
  add column if not exists last_attempted_at timestamptz,
  -- The category the failure was classified into, for grouping and for
  -- deciding whether a retry is worth offering. Never shown raw.
  add column if not exists error_code        text,
  -- The provider's own words. Internal only; `error` holds what the user reads.
  add column if not exists internal_error    text;

-- Answers "is this row due?" without scanning the whole queue.
create index if not exists marketing_os_scheduled_posts_due_idx
  on public.marketing_os_scheduled_posts (status, scheduled_time);

-- Answers "which rows belong to the same publication?", which is what lets one
-- platform fail without the others being reported as failed.
create index if not exists marketing_os_scheduled_posts_group_idx
  on public.marketing_os_scheduled_posts (generated_content_id, platform);

-- A published post has exactly one id from the platform it went to. Recording
-- the same one twice means the same content was published twice, which is the
-- outcome this whole migration exists to prevent — so the database refuses it
-- rather than leaving it to be noticed later.
--
-- Partial, because the overwhelming majority of rows have no external id yet
-- and NULLs would otherwise all have to be indexed.
create unique index if not exists marketing_os_scheduled_posts_external_id_key
  on public.marketing_os_scheduled_posts (platform, external_post_id)
  where external_post_id is not null;

comment on column public.marketing_os_scheduled_posts.attempts is
  'How many times publishing has been tried, so a permanently failing post stops being retried forever.';
comment on column public.marketing_os_scheduled_posts.internal_error is
  'The provider''s own error text. Never rendered in the customer UI.';
