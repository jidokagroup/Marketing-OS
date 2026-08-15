-- A real "approved" status for generated content, distinct from scheduled
-- or published. Previously the detail page only ever inferred a status
-- (draft / needs revision / scheduled / published) with no way to mark a
-- piece as reviewed and ready before it's actually queued to go out.

alter table if exists public.marketing_os_generated_content
  add column if not exists approved_at timestamptz;

comment on column public.marketing_os_generated_content.approved_at is
  'When a human marked this piece as reviewed and ready. Null means not yet approved. Independent of scheduling/publishing status.';
