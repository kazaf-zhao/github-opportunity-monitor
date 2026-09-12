create extension if not exists pgcrypto;
create table if not exists repositories(id uuid primary key default gen_random_uuid(),github_id bigint not null unique,owner text not null,name text not null,full_name text not null unique,description text,github_url text not null,stars integer not null default 0,forks integer not null default 0,open_issues integer not null default 0,primary_language text,topics text[] not null default '{}',created_at timestamptz not null,pushed_at timestamptz,updated_at timestamptz not null default now(),last_snapshot_at timestamptz,growth_score numeric(5,2),opportunity_score numeric(5,2),signals text[] not null default '{}');
create table if not exists repository_snapshots(id bigint generated always as identity primary key,repository_id uuid not null references repositories(id) on delete cascade,stars integer not null,forks integer not null,open_issues integer not null,captured_at timestamptz not null default now());
create index if not exists snapshots_repo_time_idx on repository_snapshots(repository_id,captured_at desc);create index if not exists repositories_score_idx on repositories(opportunity_score desc nulls last);create index if not exists repositories_snapshot_queue_idx on repositories(last_snapshot_at asc nulls first);
create table if not exists keyword_monitors(id uuid primary key default gen_random_uuid(),keyword text not null unique,enabled boolean not null default true,created_at timestamptz not null default now());
create table if not exists repository_keyword_matches(repository_id uuid not null references repositories(id) on delete cascade,keyword_monitor_id uuid not null references keyword_monitors(id) on delete cascade,matched_at timestamptz not null default now(),primary key(repository_id,keyword_monitor_id));
insert into keyword_monitors(keyword) values('AI Agent'),('MCP'),('Browser Agent'),('Trading Agent'),('Prediction Market'),('Polymarket'),('Crypto AI'),('Stablecoin'),('RAG'),('Voice AI'),('Computer Use'),('OpenAI'),('Claude'),('Local AI') on conflict do nothing;
create or replace view repository_growth_metrics as
with points as (
  select r.*,
    (select s.stars from repository_snapshots s where s.repository_id=r.id and s.captured_at<=now()-interval '24 hours' order by s.captured_at desc limit 1) stars_at_24h,
    (select s.stars from repository_snapshots s where s.repository_id=r.id and s.captured_at<=now()-interval '48 hours' order by s.captured_at desc limit 1) stars_at_48h,
    (select s.stars from repository_snapshots s where s.repository_id=r.id and s.captured_at<=now()-interval '7 days' order by s.captured_at desc limit 1) stars_at_7d,
    (select s.stars from repository_snapshots s where s.repository_id=r.id and s.captured_at<=now()-interval '30 days' order by s.captured_at desc limit 1) stars_at_30d,
    (select s.forks from repository_snapshots s where s.repository_id=r.id and s.captured_at<=now()-interval '24 hours' order by s.captured_at desc limit 1) forks_at_24h
  from repositories r
)
select id,full_name,stars,forks,open_issues,
  greatest(stars-stars_at_24h,0) as stars_24h,
  greatest(stars-stars_at_7d,0) as stars_7d,
  greatest(stars-stars_at_30d,0) as stars_30d,
  greatest(forks-forks_at_24h,0) as forks_24h,
  round(greatest(stars-stars_at_24h,0)::numeric/24,2) as stars_per_hour,
  round(100*greatest(stars-stars_at_24h,0)::numeric/nullif(stars_at_24h,0),2) as star_growth_percentage,
  round(greatest(stars-stars_at_24h,0)::numeric/nullif(greatest(stars_at_24h-stars_at_48h,0),0),2) as growth_acceleration
from points;
