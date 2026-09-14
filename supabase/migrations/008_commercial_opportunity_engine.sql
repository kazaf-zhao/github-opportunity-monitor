create table if not exists commercial_analyses (
  repository_id uuid primary key references repositories(id) on delete cascade,
  analysis_version integer not null default 1,
  analyzed_at timestamptz not null default now(),
  issue_window_start timestamptz not null,
  demand_score smallint not null check (demand_score between 0 and 100),
  commercial_score smallint not null check (commercial_score between 0 and 100),
  indie_score smallint not null check (indie_score between 0 and 100),
  competition_gap smallint not null check (competition_gap between 0 and 100),
  money_score smallint not null check (money_score between 0 and 100),
  opportunity_types text[] not null default '{}',
  monetization_ideas jsonb not null default '[]'::jsonb,
  why_now text not null,
  user_pain text not null,
  what_to_build text not null,
  who_pays text not null,
  monetization text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  estimated_mvp text not null,
  evidence jsonb not null default '{}'::jsonb
);

create index if not exists idx_commercial_analyses_money_score
  on commercial_analyses(money_score desc, analyzed_at desc);
create index if not exists idx_commercial_analyses_refresh
  on commercial_analyses(analyzed_at asc);
create index if not exists idx_commercial_analyses_types
  on commercial_analyses using gin(opportunity_types);

alter table commercial_analyses enable row level security;
alter table commercial_analyses
  add column if not exists analysis_version integer not null default 1;
grant select, insert, update on commercial_analyses to service_role;

alter table collector_runs drop constraint if exists collector_runs_job_check;
alter table collector_runs add constraint collector_runs_job_check
  check (job in ('discover', 'snapshot', 'commercial'));

comment on table commercial_analyses is
  'Rule-based commercial opportunity analysis based on repository README and recent GitHub Issue titles';
comment on column commercial_analyses.money_score is
  'Research priority score, not a revenue prediction';
comment on column commercial_analyses.evidence is
  'Auditable README keyword counts, Issue type counts, and representative Issue titles';
