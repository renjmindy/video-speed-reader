# Worker image for M4 (Fargate). Same code runs under M1 (EC2) too —
# the env-first _load_secrets() in worker.py picks up credentials from
# containerOverrides when running on Fargate, or from AWS Secrets Manager
# when running under the EC2 IAM instance profile.
FROM python:3.12-slim

# ffmpeg + ffprobe are shelled out from worker.py (yt-dlp → ffmpeg to mp3
# → ffmpeg chunk-split). Baking them into the image means no apt install
# in the hot path and no runtime download.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .

# JOB_ID + the three credentials arrive as env vars via the Lambda's
# ecs:RunTask containerOverrides[].environment.
CMD ["python", "worker.py"]
