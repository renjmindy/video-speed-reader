-- M1.5 followup: match the Supabase free-tier 50 MiB per-file cap exactly.
--
-- The initial migration set file_size_limit to 100 MiB, but the free-tier
-- project cap is lower — a 50-100 MiB upload would clear the bucket check
-- then fail at the project level with HTTP 413. Setting the bucket to 50 MiB
-- gives one single, honest error at the browser-visible layer.

update storage.buckets
set file_size_limit = 52428800 -- 50 MiB
where id = 'uploads';
