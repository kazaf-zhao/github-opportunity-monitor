# GitHub Opportunity Monitor

A production-oriented MVP for discovering real GitHub repositories with abnormal early traction. Production pages contain no demo repositories: current metadata comes from GitHub, while every growth metric and chart point comes from persisted Supabase snapshots.

## Run locally

Copy `.env.example` to `.env.local`, add a GitHub token and Supabase service-role credentials, then run `npm run dev`. Apply every SQL file in `supabase/migrations` in numeric order first. The service-role key and GitHub token are read only by server modules and must never use a `NEXT_PUBLIC_` prefix.

## Data pipeline

- `/api/repositories` evaluates up to 1,000 young, recently pushed, or sub-20k-star candidates before sorting and returning the requested Top N. It derives 1h/24h/7d/30d growth, relative growth, velocity, acceleration, signals, and Opportunity Score from snapshots.
- Historical windows use the newest snapshot at or before the target time. Per-window tolerances reject stale points instead of reporting misleading growth.
- `/api/cron/discover` runs hourly and rotates three keyword groups. It varies age/activity/star thresholds, paginates results, deduplicates GitHub IDs, and stores the first real snapshot immediately.
- `/api/cron/update` refreshes the least-recently checked repositories.
- `/api/cron/snapshots` appends immutable measurements used for growth calculations.
- `vercel.json` schedules all three jobs. Set `CRON_SECRET` in production.

The collector caches reads, reports rate-limit headers, retries transient errors with capped exponential backoff, and isolates individual query/repository failures. Opportunity scoring and breakout rules live in `lib/scoring.ts`; weights are centralized for safe tuning. `/admin/data-status` is an operational page and should remain behind Vercel Deployment Protection or another trusted access layer.

On a fresh deployment, total stars appear after discovery. Growth stays `null` and the UI displays “采集中” until the relevant snapshot window actually exists; the application never synthesizes history.
