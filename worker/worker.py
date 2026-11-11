"""
Worker: polls one job at a time, downloads the video, runs Whisper,
writes TXT back to job_sessions.subtitle_txt_content.

Reads JOB_ID from env. The three credentials (OPENAI_API_KEY, SUPABASE_URL,
SUPABASE_SECRET_KEY) resolve in this order:

  1. If all three are present as env vars → use them.
     This is the M4 / Fargate path — the Lambda distributor passes them via
     containerOverrides, and the Fargate worker task role stays minimal
     (no secretsmanager:GetSecretValue).
  2. Otherwise → read them from AWS Secrets Manager (M1 / EC2 path).
     The EC2's IAM instance profile grants secretsmanager:GetSecretValue
     on exactly those three secret names.

The same image therefore runs under both M1 and M4 without a rebuild.
"""
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import boto3
from openai import OpenAI
from supabase import create_client


_CRED_KEYS = ("OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY")
_SECRET_NAMES = {
    "OPENAI_API_KEY": "openai-api-key",
    "SUPABASE_URL": "supabase-url",
    "SUPABASE_SECRET_KEY": "supabase-secret-key",
}


def _get_secret(client, name: str) -> str:
    """Fetch one Secrets Manager secret by name (returns the SecretString)."""
    return client.get_secret_value(SecretId=name)["SecretString"]


def _load_secrets() -> dict[str, str]:
    """Prefer env vars (M4 / Fargate) → fall back to Secrets Manager (M1 / EC2)."""
    if all(os.environ.get(k) for k in _CRED_KEYS):
        return {k: os.environ[k] for k in _CRED_KEYS}
    sm = boto3.client("secretsmanager")
    return {k: _get_secret(sm, _SECRET_NAMES[k]) for k in _CRED_KEYS}


_secrets = _load_secrets()
db = create_client(_secrets["SUPABASE_URL"], _secrets["SUPABASE_SECRET_KEY"])
openai_client = OpenAI(api_key=_secrets["OPENAI_API_KEY"])

# OpenAI Whisper has a 25 MB file-size limit. 10 minutes of 64 kbps mono mp3 ~= 4.8 MB,
# safely under the limit. Long videos get split into 600-second chunks.
CHUNK_SECONDS = 600


def get_job(job_id: str) -> dict:
    return db.table("jobs").select("*").eq("id", job_id).single().execute().data


def update_job(job_id: str, **fields) -> None:
    db.table("jobs").update({**fields, "updated_at": "now()"}).eq("id", job_id).execute()


def update_session(session_id: str, **fields) -> None:
    db.table("job_sessions").update(fields).eq("id", session_id).execute()


def _parse_supabase_uri(uri: str) -> tuple[str, str]:
    """supabase://bucket/key -> (bucket, key)."""
    rest = uri[len("supabase://"):]
    bucket, _, key = rest.partition("/")
    if not bucket or not key:
        raise ValueError(f"Malformed supabase URI: {uri}")
    return bucket, key


def download_video(url: str, dest_dir: Path) -> Path:
    """Fetch the source media. Three schemes: supabase:// (user upload via
    the /upload page), http(s):// (yt-dlp), or a bare local path (dev only)."""
    if url.startswith("supabase://"):
        bucket, key = _parse_supabase_uri(url)
        suffix = Path(key).suffix or ".bin"
        out = dest_dir / f"video{suffix}"
        data = db.storage.from_(bucket).download(key)
        out.write_bytes(data)
        return out
    if url.startswith(("http://", "https://")):
        out_template = str(dest_dir / "video.%(ext)s")
        subprocess.run(["yt-dlp", "-o", out_template, url], check=True)
        return next(dest_dir.glob("video.*"))
    return Path(url).expanduser().resolve()


def cleanup_source(url: str) -> None:
    """Delete the uploaded object from Supabase Storage after a successful
    transcription. Local temp files on EC2 are already cleaned up by the
    TemporaryDirectory context manager that wraps the pipeline."""
    if not url.startswith("supabase://"):
        return
    try:
        bucket, key = _parse_supabase_uri(url)
        db.storage.from_(bucket).remove([key])
    except Exception as e:
        # Non-fatal: the transcript is already written, we just leaked a blob.
        print(f"cleanup_source failed for {url}: {e}", file=sys.stderr, flush=True)


def to_mp3(video_path: Path, dest_dir: Path) -> Path:
    """Convert any video/audio container to 64 kbps mono 16 kHz mp3 (Whisper-friendly)."""
    mp3 = dest_dir / "audio.mp3"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vn", "-ac", "1",
            "-ar", "16000", "-ab", "64k",
            "-acodec", "libmp3lame",
            str(mp3),
        ],
        check=True,
        capture_output=True,
    )
    return mp3


def get_duration_seconds(audio_path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def split_chunks(mp3_path: Path, dest_dir: Path) -> list[Path]:
    """Split into CHUNK_SECONDS-second chunks (re-encode to keep sizes predictable)."""
    duration = get_duration_seconds(mp3_path)
    n_chunks = max(1, math.ceil(duration / CHUNK_SECONDS))
    chunks = []
    for i in range(n_chunks):
        chunk = dest_dir / f"chunk_{i:03d}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-ss", str(i * CHUNK_SECONDS),
                "-t", str(CHUNK_SECONDS),
                "-acodec", "libmp3lame",
                "-ab", "64k",
                str(chunk),
            ],
            check=True,
            capture_output=True,
        )
        chunks.append(chunk)
    return chunks


def transcribe_chunk(chunk_path: Path, language: str) -> str:
    with open(chunk_path, "rb") as f:
        return openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="text",
            language=language,
        )


def main() -> None:
    job_id = os.environ["JOB_ID"]
    job = get_job(job_id)
    session_id = job["current_session_id"]

    update_job(job_id, status="downloading")
    print(f"[{job_id}] downloading {job['video_source_url']}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        video = download_video(job["video_source_url"], tmp_path)
        mp3 = to_mp3(video, tmp_path)

        update_job(job_id, status="transcribe")
        chunks = split_chunks(mp3, tmp_path)
        print(f"[{job_id}] transcribing {len(chunks)} chunk(s)")

        full_text = "\n\n".join(
            transcribe_chunk(c, job["language"]) for c in chunks
        )

        update_session(session_id, subtitle_txt_content=full_text)
        update_job(job_id, status="done")

    cleanup_source(job["video_source_url"])
    print(f"[{job_id}] done — {len(full_text)} chars")


if __name__ == "__main__":
    main()
