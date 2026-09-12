create table if not exists collector_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('discover', 'snapshot')),
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  processed_count integer,
  request_count integer,
  rate_limit_remaining integer,
  rate_limit_reset timestamptz,
  error_message text
);

create index if not exists collector_runs_job_started_idx
  on collector_runs(job, started_at desc);
