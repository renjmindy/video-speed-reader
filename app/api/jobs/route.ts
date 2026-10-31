import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type SubmitBody = {
  video_source_url?: string;
  topic?: string | null;
  language?: "zh" | "en" | "ja";
};

export async function POST(req: Request) {
  // 1. Authenticate the caller via the cookie session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SubmitBody;
  if (
    !body.video_source_url ||
    typeof body.video_source_url !== "string" ||
    body.video_source_url.length < 8
  ) {
    return NextResponse.json(
      { error: "video_source_url required" },
      { status: 400 },
    );
  }
  const language: SubmitBody["language"] =
    body.language === "en" || body.language === "ja" ? body.language : "zh";

  // 2. Use the Supabase Secret key to insert the job + session rows.
  // The user is already authenticated above; the service-role key bypasses
  // RLS so we can insert both rows and backfill current_session_id in one
  // round-trip without policy ping-pong.
  const admin = createServiceClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SECRET_KEY"]!,
  );

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      user_id: user.id,
      video_source_url: body.video_source_url,
      topic: body.topic ?? null,
      language,
      status: "pending",
    })
    .select()
    .single();
  if (jobErr || !job) {
    return NextResponse.json(
      { error: jobErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  const { data: session, error: sessErr } = await admin
    .from("job_sessions")
    .insert({ job_id: job.id, session_number: 1 })
    .select()
    .single();
  if (sessErr || !session) {
    return NextResponse.json(
      { error: sessErr?.message ?? "session insert failed" },
      { status: 500 },
    );
  }

  await admin
    .from("jobs")
    .update({ current_session_id: session.id })
    .eq("id", job.id);

  return NextResponse.json({ job_id: job.id });
}
