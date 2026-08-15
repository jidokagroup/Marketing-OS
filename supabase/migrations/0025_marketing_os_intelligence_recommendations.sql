-- Adds a synthesized "recommended moves" layer to competitor scan reports.
--
-- Each scan already produces several intelligence categories (topics, hooks,
-- gaps, offers, etc). This column holds a short, ranked synthesis across all
-- of them -- decisions to brief the team on, not finished content -- so the
-- Intelligence page can lead with "what to do" instead of making the reader
-- infer it from ten separate lists.

alter table if exists public.marketing_os_social_intelligence_reports
  add column if not exists recommendations jsonb not null default '[]'::jsonb;

comment on column public.marketing_os_social_intelligence_reports.recommendations is
  'Array of {focus, move, why} objects: up to 3 ranked decisions synthesized from the scan. Never finished copy or a scheduling instruction -- content generation and distribution are out of scope for this layer.';
