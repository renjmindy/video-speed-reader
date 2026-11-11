"""
M4 distributor: a tiny Lambda that replaces M1's always-on distributor.py.

Fired every minute by EventBridge. Each tick:
  1. SELECT pending jobs whose current session has no fargate_task_arn.
  2. _ensure_session() — find or create the session row AND link it back to
     jobs.current_session_id (the easy-to-miss link; see note below).
  3. ecs:RunTask (fire-and-forget) with the three credentials passed via
     containerOverrides[].environment — so the Fargate worker task role
     stays minimal (no secretsmanager:GetSecretValue needed).
  4. UPDATE job_sessions SET fargate_task_arn = <ARN> so the next tick
     skips this job (the one durable piece of state the stateless Lambda
     can't keep in memory).

Scope: M4 ships only the spawn pass. Stuck-job recovery and storage
cleanup (the production distributor's other two passes) are future work.

Env vars this handler expects (set at create-function time):
    SUPABASE_URL
    SUPABASE_SECRET_KEY      - sb_secret_* — bypasses RLS to see all users' jobs
    OPENAI_API_KEY           - forwarded to Fargate; not used by this Lambda
    ECS_CLUSTER              - e.g. video-speed-reader-workers
    TASK_DEFINITION          - e.g. video-speed-reader-worker (latest revision used)
    SUBNETS                  - comma-separated subnet IDs
    SECURITY_GROUPS          - optional; comma-separated; defaults to VPC default
    ASSIGN_PUBLIC_IP         - "ENABLED" (default) or "DISABLED"
    CONTAINER_NAME           - default "worker" (must match the task def)
"""
import os
from typing import Any

import boto3
from supabase import create_client


_SUPABASE_URL = os.environ["SUPABASE_URL"]
_SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
_OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
_ECS_CLUSTER = os.environ["ECS_CLUSTER"]
_TASK_DEFINITION = os.environ["TASK_DEFINITION"]
_SUBNETS = [s.strip() for s in os.environ["SUBNETS"].split(",") if s.strip()]
_SECURITY_GROUPS = [s.strip() for s in os.environ.get("SECURITY_GROUPS", "").split(",") if s.strip()]
_ASSIGN_PUBLIC_IP = os.environ.get("ASSIGN_PUBLIC_IP", "ENABLED")
_CONTAINER_NAME = os.environ.get("CONTAINER_NAME", "worker")

_db = create_client(_SUPABASE_URL, _SUPABASE_SECRET_KEY)
_ecs = boto3.client("ecs")


def _ensure_session(job_id: str) -> str:
    """Return the id of the current session for `job_id`, creating it if needed.

    The easy-to-miss link: after inserting a new job_sessions row we MUST also
    write jobs.current_session_id = <new id>. Without this, direct-INSERT test
    jobs (and any code path that inserts a job without going through
    POST /api/jobs) ends up with a null link, and worker.py crashes on its
    first update_session() call. Production traffic hides this because
    POST /api/jobs creates both rows atomically and sets the link — but the
    Lambda must not rely on that.
    """
    job = (
        _db.table("jobs")
        .select("current_session_id")
        .eq("id", job_id)
        .single()
        .execute()
        .data
    )
    if job and job.get("current_session_id"):
        return job["current_session_id"]

    row = (
        _db.table("job_sessions")
        .insert({"job_id": job_id, "session_number": 1})
        .execute()
        .data[0]
    )
    # ← the easy-to-miss link
    _db.table("jobs").update(
        {"current_session_id": row["id"]}
    ).eq("id", job_id).execute()
    return row["id"]


def _session_arn(session_id: str) -> str | None:
    row = (
        _db.table("job_sessions")
        .select("fargate_task_arn")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    )
    return (row or {}).get("fargate_task_arn")


def _run_task(job_id: str) -> str:
    """Spawn one Fargate task for this job. Returns the task ARN."""
    network = {
        "awsvpcConfiguration": {
            "subnets": _SUBNETS,
            "assignPublicIp": _ASSIGN_PUBLIC_IP,
        }
    }
    if _SECURITY_GROUPS:
        network["awsvpcConfiguration"]["securityGroups"] = _SECURITY_GROUPS

    resp = _ecs.run_task(
        cluster=_ECS_CLUSTER,
        taskDefinition=_TASK_DEFINITION,
        launchType="FARGATE",
        count=1,
        networkConfiguration=network,
        overrides={
            "containerOverrides": [{
                "name": _CONTAINER_NAME,
                "environment": [
                    {"name": "JOB_ID", "value": job_id},
                    {"name": "SUPABASE_URL", "value": _SUPABASE_URL},
                    {"name": "SUPABASE_SECRET_KEY", "value": _SUPABASE_SECRET_KEY},
                    {"name": "OPENAI_API_KEY", "value": _OPENAI_API_KEY},
                ],
            }],
        },
    )
    failures = resp.get("failures") or []
    if failures or not resp.get("tasks"):
        raise RuntimeError(f"ecs:RunTask failed for job {job_id}: {failures or 'no task returned'}")
    return resp["tasks"][0]["taskArn"]


def handler(event: dict, context: Any) -> dict:
    """EventBridge entrypoint. Returns a summary dict for CloudWatch."""
    pending = (
        _db.table("jobs")
        .select("id, current_session_id, status, created_at")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
        .data
        or []
    )

    spawned: list[dict] = []
    skipped: list[str] = []
    errors: list[dict] = []

    for job in pending:
        job_id = job["id"]
        try:
            session_id = _ensure_session(job_id)
            if _session_arn(session_id):
                # Already spawned by a previous tick; the worker is still running
                # (or has crashed, in which case the EC2 fallback is the recovery
                # path for M4 — stuck-job handling is a v2 roadmap item).
                skipped.append(job_id)
                continue

            task_arn = _run_task(job_id)
            _db.table("job_sessions").update(
                {"fargate_task_arn": task_arn}
            ).eq("id", session_id).execute()
            spawned.append({"job_id": job_id, "session_id": session_id, "task_arn": task_arn})
        except Exception as e:  # noqa: BLE001 — surface and continue so one bad row doesn't halt the tick
            errors.append({"job_id": job_id, "error": str(e)[:200]})

    summary = {
        "pending": len(pending),
        "spawned": len(spawned),
        "skipped_already_running": len(skipped),
        "errors": len(errors),
    }
    # Log the detail; CloudWatch keeps it for debugging.
    print({"summary": summary, "spawned_detail": spawned, "errors_detail": errors})
    return summary
