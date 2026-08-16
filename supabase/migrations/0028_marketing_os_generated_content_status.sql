-- Move content generation off the request path, same fix already applied to
-- competitor scans in 0022.
--
-- The generate route did retrieval + a Claude call + QC scoring inline,
-- inside a synchronous Netlify Function. `export const maxDuration = 60` is
-- a Next.js/Vercel convention; Netlify's actual platform ceiling for a
-- regular (non-background) function is far lower regardless of that
-- declaration, so a heavy request (many channels, a full blog post, a full
-- email) got killed by the platform itself before Claude could respond --
-- a raw timeout with no graceful fallback, worse than the deterministic
-- fallback template this was supposed to avoid.
--
-- Rows now carry a lifecycle: the route inserts a `queued` row (request
-- fields only) and returns immediately; a background function promotes it
-- to `running`, then fills in the generated fields and flips it to
-- `complete` (or `failed` with a reason). RLS is unchanged -- the existing
-- owner-scoped policies still apply, and the worker uses the service-role
-- client while filtering by the row id it was handed.

alter table if exists public.marketing_os_generated_content
  add column if not exists status         text not null default 'complete'
    check (status in ('queued', 'running', 'complete', 'failed')),
  add column if not exists error_message  text,
  add column if not exists requested_at   timestamptz not null default now();

create index if not exists marketing_os_generated_content_status_idx
  on public.marketing_os_generated_content (status, requested_at);

comment on column public.marketing_os_generated_content.status is
  'Generation lifecycle: queued -> running -> complete | failed. Existing rows default to complete.';
comment on column public.marketing_os_generated_content.error_message is
  'Why generation failed, when status is failed.';
comment on column public.marketing_os_generated_content.requested_at is
  'When generation was queued. Drives worker ordering.';
