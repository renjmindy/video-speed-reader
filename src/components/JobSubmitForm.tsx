"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Language = "zh" | "en" | "ja";

export function JobSubmitForm() {
  const router = useRouter();
  const [videoSourceUrl, setVideoSourceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_source_url: videoSourceUrl,
          topic: topic || undefined,
          language,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        job_id?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      toast.success("Job submitted. Refreshing…");
      setVideoSourceUrl("");
      setTopic("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="video-url">Video URL</Label>
        <Input
          id="video-url"
          type="url"
          required
          autoComplete="off"
          placeholder="Direct mp4 / mp3 URL (e.g. CloudFront, Vimeo, Internet Archive)"
          value={videoSourceUrl}
          onChange={(e) => setVideoSourceUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="topic">Topic (optional)</Label>
        <Input
          id="topic"
          type="text"
          autoComplete="off"
          placeholder="e.g. Tech podcast — useful context for the model"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="language">Language</Label>
        <Select
          value={language}
          onValueChange={(v) => setLanguage(v as Language)}
        >
          <SelectTrigger id="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">中文 (zh)</SelectItem>
            <SelectItem value="en">English (en)</SelectItem>
            <SelectItem value="ja">日本語 (ja)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting…" : "Transcribe"}
      </Button>
    </form>
  );
}
