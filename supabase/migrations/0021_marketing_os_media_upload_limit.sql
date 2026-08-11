-- Allow scheduler media uploads up to 500 MB.
-- Videos upload directly from the browser to Supabase Storage with a signed URL,
-- but the bucket itself must also allow files above the default limit.

insert into storage.buckets (id, name, public, file_size_limit)
values ('marketing-os-media', 'marketing-os-media', false, 524288000)
on conflict (id) do update
set file_size_limit = 524288000,
    public = false;
