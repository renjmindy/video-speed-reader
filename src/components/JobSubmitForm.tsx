"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

type Language = "zh" | "en" | "ja";
type Mode = "upload" | "url";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MiB — matches the bucket's file_size_limit

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "bin";
  return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function humanBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function JobSubmitForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [videoSourceUrl, setVideoSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<Language>("zh");

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFileToStorage(f: File): Promise<string> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    if (f.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File is ${humanBytes(f.size)}; the maximum upload size is ${humanBytes(MAX_UPLOAD_BYTES)}.`,
      );
    }

    const objectPath = `${user.id}/${randomSuffix()}.${fileExt(f.name)}`;

    // Mint a one-shot signed upload URL under the user's own folder
    // (RLS allows this via the "uploads: users insert own folder" policy).
    const { data: signed, error: signErr } = await supabase.storage
      .from("uploads")
      .createSignedUploadUrl(objectPath);
    if (signErr || !signed) {
      throw new Error(signErr?.message ?? "Could not create upload URL");
    }

    // Upload with XMLHttpRequest so we can read upload progress — fetch()
    // doesn't expose upload progress yet.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.signedUrl);
      xhr.setRequestHeader(
        "Content-Type",
        f.type || "application/octet-stream",
      );
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadPct(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else
          reject(
            new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`),
          );
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.send(f);
    });

    return `supabase://uploads/${objectPath}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setUploadPct(null);

    try {
      let sourceUrl: string;
      if (mode === "upload") {
        if (!file) {
          setError("Choose a file to upload.");
          return;
        }
        setUploadPct(0);
        sourceUrl = await uploadFileToStorage(file);
      } else {
        if (!videoSourceUrl.trim()) {
          setError("Paste a URL.");
          return;
        }
        sourceUrl = videoSourceUrl.trim();
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_source_url: sourceUrl,
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
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setUploadPct(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload file</TabsTrigger>
          <TabsTrigger value="url">Paste URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3 pt-4">
          <Label htmlFor="file">Audio or video file</Label>
          <Input
            ref={fileInputRef}
            id="file"
            type="file"
            accept="audio/*,video/*"
            required={mode === "upload"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-xs text-muted-foreground">
              {file.name} · {humanBytes(file.size)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Uploaded straight from your browser to your private storage
              folder. The worker pulls it with the service-role key and deletes
              both the uploaded object and its on-disk copy once the transcript
              is written. Max {humanBytes(MAX_UPLOAD_BYTES)}.
            </p>
          )}
          {uploadPct !== null ? (
            <div className="space-y-1">
              <Progress value={uploadPct} />
              <p className="text-xs text-muted-foreground">
                Uploading… {uploadPct}%
              </p>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="url" className="space-y-3 pt-4">
          <Label htmlFor="video-url">Video URL</Label>
          <Input
            id="video-url"
            type="url"
            required={mode === "url"}
            autoComplete="off"
            placeholder="Direct mp4 / mp3 URL (e.g. CloudFront, Vimeo, Internet Archive)"
            value={videoSourceUrl}
            onChange={(e) => setVideoSourceUrl(e.target.value)}
          />
        </TabsContent>
      </Tabs>

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
        {loading
          ? uploadPct !== null
            ? `Uploading ${uploadPct}%…`
            : "Submitting…"
          : "Transcribe"}
      </Button>
    </form>
  );
}
