-- Move competitor scans off the request path.
--
-- "Save & scan competitors" used to run the scan inside the server action. That
-- work takes up to ~90s (site fetches, plus a Claude call that may retry), which
-- is far past the serverless function budget, so the function was killed
-- mid-request and the Intelligence page failed to load whenever the watchlist
-- had entries.
--
-- Reports now carry a lifecycle: the action inserts a `queued` row and returns
-- immediately; a background worker promotes it to `running`, then `complete`
-- (or `failed` with a reason). RLS is unchanged — the existing owner-scoped
-- policies from 0015 still apply, and the worker uses the service-role client
-- while filtering by the report id it was handed.

alter table if exists public.marketing_os_social_intelligence_reports
  add column if not exists status        text not null default 'complete',
  add column if not exists error_message text,
  add column if not exists requested_at  timestamptz not null default now(),
  add column if not exists client_id     uuid references public.marketing_os_clients (id) on delete set null;

alter table if exists public.marketing_os_social_intelligence_reports
  drop constraint if exists marketing_os_social_intelligence_reports_status_check;

alter table if exists public.marketing_os_social_intelligence_reports
  add constraint marketing_os_social_intelligence_reports_status_check
  check (status in ('queued', 'running', 'complete', 'failed'));

-- The background worker claims the oldest queued row, and retries rows left
-- `running` by a worker that died mid-scan.
create index if not exists marketing_os_social_intelligence_reports_status_idx
  on public.marketing_os_social_intelligence_reports (status, requested_at);

comment on column public.marketing_os_social_intelligence_reports.status is
  'Scan lifecycle: queued -> running -> complete | failed. Existing rows default to complete.';
comment on column public.marketing_os_social_intelligence_reports.error_message is
  'Why the live scan failed, when status is failed. Baseline guidance stays on the row so the page remains useful.';
comment on column public.marketing_os_social_intelligence_reports.requested_at is
  'When the scan was queued. Drives worker ordering and stale-run detection.';
comment on column public.marketing_os_social_intelligence_reports.client_id is
  'Client the scan was queued for, so the worker can load industry and notes for prompt context.';
