-- Per-channel CTAs and blog SEO fields for generated content.
--
-- Previously every variant (short-form script, blog, email) shared the same
-- single `cta` request input verbatim -- an email would end with a
-- "Comment 'X'" CTA that only makes sense on social. Blog and email now get
-- their own AI-written, channel-appropriate CTA, and blog gets structured
-- SEO/AEO keywords plus suggested internal link opportunities so it reads
-- like a real blog post instead of plain text.
--
-- short_version and organic_version (short caption, carousel copy) are no
-- longer generated here -- that content now comes from Convia's content
-- generator as part of the distribution layer. The columns stay for
-- existing rows; new rows simply leave them null.

alter table if exists public.generated_content
  add column if not exists blog_cta               text,
  add column if not exists email_cta               text,
  add column if not exists blog_keywords           jsonb not null default '[]'::jsonb,
  add column if not exists blog_link_suggestions   jsonb not null default '[]'::jsonb;

comment on column public.generated_content.blog_cta is
  'AI-written CTA styled for a blog reader (read/explore/download), distinct from the social CTA embedded in primary_script.';
comment on column public.generated_content.email_cta is
  'AI-written CTA styled for an email reader (reply/click/book), distinct from the social CTA embedded in primary_script.';
comment on column public.generated_content.blog_keywords is
  'SEO/AEO keywords and phrases the blog post should target. Empty unless the Blog post channel was selected.';
comment on column public.generated_content.blog_link_suggestions is
  'Suggested internal link opportunities (anchor text + what it should point to -- a social post, a form, a page). Not live URLs; the user wires up the actual link.';
