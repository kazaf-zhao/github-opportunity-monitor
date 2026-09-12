# GitHub Opportunity Monitor

A production-oriented MVP for discovering real GitHub repositories with abnormal early traction. Production pages contain no demo repositories: current metadata comes from GitHub, while every growth metric and chart point comes from persisted Supabase snapshots.

## Run locally

Copy `.env.example` to `.env.local`, add a GitHub token and Supabase service-role credentials, then run `npm run dev`. Apply every SQL file in `supabase/migrations` in numeric order first. The service-role key and GitHub token are read only by server modules and must never use a `NEXT_PUBLIC_` prefix.

## Data pipeline

- `/api/repositories` merges seven bounded recall channels: recently created, recently active, small repositories, early-stage repositories, star spikes, acceleration, and high relative growth. It deduplicates candidates, enforces early/mature quotas, applies one snapshot metric pipeline and score, then returns the requested Top N.
- Historical windows use the newest snapshot at or before the target time. Per-window tolerances reject stale points instead of reporting misleading growth.
- `/api/cron/discover` runs hourly and rotates three keyword groups. It varies age/activity/star thresholds, paginates results, deduplicates GitHub IDs, and stores the first real snapshot immediately.
- `/api/cron/update` refreshes the least-recently checked repositories.
- `/api/cron/snapshots` appends immutable measurements used for growth calculations.
- `vercel.json` schedules all three jobs. Set `CRON_SECRET` in production.

The collector caches reads, reports rate-limit headers, retries transient errors with capped exponential backoff, and isolates individual query/repository failures. Opportunity scoring and breakout rules live in `lib/scoring.ts`; weights are centralized for safe tuning. `/admin/data-status` is an operational page and should remain behind Vercel Deployment Protection or another trusted access layer.

`/admin/candidates` exposes recall sources and sortable scoring inputs for algorithm debugging. Apply `006_multi_recall.sql` before using this route; it adds bounded snapshot-metric RPCs and the indexes used by the recall queries.

On a fresh deployment, total stars appear after discovery. Growth stays `null` and the UI displays “采集中” until the relevant snapshot window actually exists; the application never synthesizes history.
