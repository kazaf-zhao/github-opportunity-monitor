# GitHub Opportunity Monitor

A production-oriented MVP for discovering GitHub repositories with abnormal early traction. The UI ships with representative data so it is useful immediately; configured deployments collect authenticated GitHub data into historical Supabase snapshots.

## Run locally

Copy `.env.example` to `.env.local`, add a GitHub token and Supabase service-role credentials, then run `npm run dev`. Apply `supabase/migrations/001_initial_schema.sql` to the Supabase project first.

## Data pipeline

- `/api/cron/discover` searches for young repositories and upserts metadata.
- `/api/cron/update` refreshes the least-recently checked repositories.
- `/api/cron/snapshots` appends immutable measurements used for growth calculations.
- `vercel.json` schedules all three jobs. Set `CRON_SECRET` in production.

The collector caches reads, reports rate-limit headers, retries transient errors with capped exponential backoff, and updates repositories in bounded batches. Opportunity scoring and breakout rules live in `lib/scoring.ts`; weights are centralized for safe tuning.
