-- Per-user audit trail for sensitive reads. The transcript download endpoint
-- writes one row per authenticated attempt; future endpoints can reuse the
-- same table by varying the `action` string.
--
-- Writes happen server-side with the service-role key (bypasses RLS).
-- Reads are RLS-gated to the row's owner so a user can audit their own
-- downloads but can't see anyone else's.
--
-- user_id is NOT NULL on purpose: we only log *authenticated* attempts.
-- Unauthenticated requests get a 401 before reaching this table; Vercel's
-- own request log is the audit trail for that layer.

create table public.access_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  action        text not null check (length(action) between 1 and 64),
  result        text not null check (length(result) between 1 and 64),
  ip            text,
  user_agent    text
);

create index idx_access_log_user_created
  on public.access_log (user_id, created_at desc);

create index idx_access_log_job
  on public.access_log (job_id);

alter table public.access_log enable row level security;

-- Users can read their own audit rows. No INSERT/UPDATE/DELETE policies —
-- only the service role (sb_secret_*) writes, which bypasses RLS.
create policy "users read own access log"
  on public.access_log for select to authenticated
  using (auth.uid() = user_id);
