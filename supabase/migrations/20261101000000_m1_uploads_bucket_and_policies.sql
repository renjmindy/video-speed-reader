-- M1.5: a private "uploads" bucket for browser-side audio/video uploads.
--
-- Each user can only read + write objects under their own folder:
--   uploads/<auth.uid()>/<random>.<ext>
-- The worker on EC2 uses the Supabase Secret key to download + delete
-- (service-role bypasses RLS).
--
-- The storage API's own CORS lets the browser PUT directly to a signed URL,
-- so audio bytes never pass through Vercel (whose serverless body limit is
-- 4.5 MB). The practical ceiling is the project's per-file upload cap in
-- Supabase Storage (50 MB on the free tier, up to 500 GB on paid).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  104857600, -- 100 MiB per file; the free-tier project cap is lower, this just prevents absurd uploads.
  array[
    'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/flac',
    'video/mp4','video/quicktime','video/x-matroska','video/webm','video/x-msvideo'
  ]
)
on conflict (id) do nothing;

-- Policies on storage.objects (RLS is already enabled on that table by Supabase).
-- storage.foldername(name) splits the object path on "/" and returns a text[].
-- We require the first segment to equal the signed-in user's id.

create policy "uploads: users insert own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "uploads: users read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "uploads: users delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
