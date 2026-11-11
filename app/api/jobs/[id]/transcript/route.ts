import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type AccessResult = "ok" | "not_found" | "not_ready" | "transcript_missing";

/** First IP in the comma-separated x-forwarded-for chain is the real client.
 *  Vercel's edge sets this header; falls back to x-real-ip then null. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth — same pattern as POST /api/jobs.
  //    Unauthenticated attempts get 401 without writing to access_log;
  //    Vercel's request log is the audit trail for that layer (user_id
  //    is NOT NULL on access_log by design — we only log authenticated reads).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SECRET_KEY"]!,
  );

  // Capture request metadata now so every exit path can log it.
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  async function logAccess(result: AccessResult): Promise<void> {
    try {
      await admin.from("access_log").insert({
        user_id: user!.id,
        job_id: id,
        action: "transcript_download",
        result,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      // Audit-log failure must never block the response. Vercel's own log
      // captures the handler run, so the event isn't lost — only the
      // user-facing audit copy would be.
      console.error("access_log insert failed:", e);
    }
  }

  // 2. Look up the job + verify ownership in one query. The service-role
  //    client bypasses RLS, so we re-impose ownership via the WHERE clause.
  //    A missing .eq('user_id', ...) here would let any signed-in user
  //    download any transcript by guessing a UUID.
  const { data: job } = await admin
    .from("jobs")
    .select("id, user_id, status, current_session_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    await logAccess("not_found");
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (job.status !== "done" || !job.current_session_id) {
    await logAccess("not_ready");
    return NextResponse.json({ error: "not ready" }, { status: 409 });
  }

  // 3. Pull the transcript text from the current session.
  const { data: session } = await admin
    .from("job_sessions")
    .select("subtitle_txt_content")
    .eq("id", job.current_session_id)
    .single();
  const txt = session?.subtitle_txt_content;
  if (!txt) {
    await logAccess("transcript_missing");
    return NextResponse.json(
      { error: "transcript missing" },
      { status: 500 },
    );
  }

  // 4. Audit the successful download, then stream it back as a file.
  await logAccess("ok");
  const filename = `transcript-${id.slice(0, 8)}.txt`;
  return new NextResponse(txt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
