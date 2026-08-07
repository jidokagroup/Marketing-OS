-- Stores uploaded playbook documents and links their scanned operating context
-- into JIDOKA Core orchestrator memory.

alter table if exists public.marketing_os_playbooks
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual','upload','import')),
  add column if not exists source_file_name text,
  add column if not exists source_mime_type text,
  add column if not exists source_byte_size integer,
  add column if not exists extracted_text text,
  add column if not exists extraction_status text not null default 'manual'
    check (extraction_status in ('manual','pending','extracted','error')),
  add column if not exists extraction_error text,
  add column if not exists orchestrator_memory_id uuid
    references public.marketing_os_memory_records (id) on delete set null;

create index if not exists marketing_os_playbooks_source_type_idx
  on public.marketing_os_playbooks (owner_id, source_type, updated_at desc);

create index if not exists marketing_os_playbooks_orchestrator_memory_idx
  on public.marketing_os_playbooks (orchestrator_memory_id);

comment on column public.marketing_os_playbooks.extracted_text is
  'Full extracted text from uploaded playbook PDFs, docs, or text files.';
comment on column public.marketing_os_playbooks.orchestrator_memory_id is
  'Linked Core memory record used by the orchestrator and specialist agents.';
