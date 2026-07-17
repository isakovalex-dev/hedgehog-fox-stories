-- Private storage for AI-generated story covers.
-- Run in Supabase SQL Editor before enabling IMAGE_GENERATION_ENABLED in Vercel.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'story-illustrations',
  'story-illustrations',
  false,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their generated story illustrations" on storage.objects;

create policy "Users can read their generated story illustrations"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'story-illustrations'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
