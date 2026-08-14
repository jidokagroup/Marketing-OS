-- Competitor scans move off the request path.
--
-- The Intelligence page used to run the scan inside the "Save & scan
-- competitors" server action. That work takes up to ~90s (site fetches plus a
-- Claude call with a retry), which exceeds the serverless function budget the
-- app deploys onto, so the function was killed mid-request and the browser had
-- no response to render.
--
-- Reports now carry a lifecycle: the action inserts a `queued` row and returns
-- immediately, a background worker promotes it to `running` and then `complete`
-- (or `failed` with a reason).

alter table public.marketing_os_social_intelligence_reports
  add column if not exists status        text not null default 'complete',
  add column if not exists error_message text,
  add column if not exists requested_at  timestamptz not null default now(),
  add column if not exists client_id     uuid references public.marketing_os_clients (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketing_os_social_intelligence_reports_status_check'
  ) then
    alter table public.marketing_os_social_intelligence_reports
      add constraint marketing_os_social_intelligence_reports_status_check
      check (status in ('queued', 'running', 'complete', 'failed'));
  end if;
end $$;

-- The page reads the newest report per owner; the worker claims the oldest
-- queued row. Both are covered here.
create index if not exists marketing_os_social_intelligence_reports_status_idx
  on public.marketing_os_social_intelligence_reports (status, requested_at);
