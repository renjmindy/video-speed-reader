# AGENTS

Notes for anyone (human or model) editing this repo.

## Deploy targets

- **Vercel** auto-deploys the Next.js app (`app/`, `src/`, `middleware.ts`, …)
  on every push to `main`. Keep `main` in a building state — a broken build
  on main immediately breaks production.
- **EC2 worker** (`worker/`) refreshes through AWS Systems Manager:
  `git pull` followed by `systemctl restart m1-distributor.service`. The EC2
  ignores `app/` and Vercel ignores `worker/`.
- **Supabase schema** lives in `supabase/migrations/*.sql`. Apply with
  `supabase db push --linked`. Never DDL directly in the dashboard — the
  migration file is the audit trail.

## Git etiquette

- **Don't rewrite published history** (force-push, rebase/amend/squash of
  pushed commits). It confuses the Vercel build cache and makes the EC2's
  `git pull` noisier than it needs to be.
- Both deploy targets build from `main`, so land small, tested commits.
  Big rewrites belong on a branch + PR.

## Secrets

- All credentials live in **AWS Secrets Manager** (`ap-southeast-2`):
  `openai-api-key`, `supabase-url`, `supabase-secret-key`,
  `supabase-publishable-key`, `github/personal-access-token`.
- Never commit a `.env` with real values. The Vite-era `.env` tracked in git
  carries only `NEXT_PUBLIC_SUPABASE_*` (the publishable key, browser-safe).
- The service-role key (`sb_secret_*`) is server-only. Never prefix with
  `NEXT_PUBLIC_`, never reference from a Client Component.
