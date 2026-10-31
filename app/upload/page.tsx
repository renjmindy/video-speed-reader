import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { JobSubmitForm } from "@/components/JobSubmitForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Upload — Video Speed Reader",
  description: "Submit a video URL and get a transcript.",
  robots: "noindex",
};

type JobRow = {
  id: string;
  created_at: string;
  video_source_url: string;
  status: "pending" | "downloading" | "transcribe" | "done";
};

const STATUS_STYLE: Record<JobRow["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  downloading: "bg-muted text-muted-foreground",
  transcribe: "bg-primary/15 text-primary-glow",
  done: "bg-emerald-500/15 text-emerald-400",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function truncate(url: string, max = 50): string {
  return url.length <= max ? url : url.slice(0, max - 1) + "…";
}

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS gates this to the current user's own rows (auth.uid() = user_id).
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, created_at, video_source_url, status")
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (jobs ?? []) as JobRow[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Button asChild variant="secondary">
            <Link href="/app">
              <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-14 sm:px-6">
        <section>
          <h1 className="text-3xl font-bold text-foreground">
            Your transcriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The 20 most recent jobs. Status updates when the worker finishes.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            {rows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No transcriptions yet. Submit your first video below.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => {
                    const shortId = job.id.slice(0, 8);
                    const isDone = job.status === "done";
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {relativeTime(job.created_at)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {truncate(job.video_source_url)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status]}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isDone ? (
                            <a
                              href={`/api/jobs/${job.id}/transcript`}
                              download={`transcript-${shortId}.txt`}
                              className="inline-flex items-center gap-1 text-primary-glow hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" /> .txt
                            </a>
                          ) : (
                            <span
                              className="text-muted-foreground/60"
                              aria-label="Transcript not ready"
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">
            New transcription
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a direct media URL. YouTube URLs are not supported in M1 —
            cloud IPs are rate-limited by YouTube.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-card p-6">
            <JobSubmitForm />
          </div>
        </section>
      </main>
    </div>
  );
}
