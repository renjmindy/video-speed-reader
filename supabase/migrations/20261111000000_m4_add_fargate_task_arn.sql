-- M4: idempotency column for the Lambda distributor.
--
-- The Lambda is stateless, so it needs a durable "did I already spawn this
-- job?" flag that replaces M1's in-memory `_spawned_jobs` set. On each tick
-- it picks jobs whose current session has `fargate_task_arn IS NULL`, calls
-- ecs:RunTask, then writes the ARN back here so the next tick skips it.
--
-- Partial index keeps the spawn query fast — only unspawned sessions get
-- indexed, which is the entire hot set.

alter table public.job_sessions
  add column if not exists fargate_task_arn text;

create index if not exists idx_job_sessions_unspawned
  on public.job_sessions (id)
  where fargate_task_arn is null;
