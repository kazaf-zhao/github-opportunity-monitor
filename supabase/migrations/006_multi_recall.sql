alter table repositories
  add column if not exists archived boolean not null default false;

create index if not exists idx_repositories_created_at
  on repositories(created_at desc);
create index if not exists idx_repositories_pushed_at
  on repositories(pushed_at desc);
create index if not exists idx_repositories_stars
  on repositories(stars);
create index if not exists idx_repositories_last_snapshot_at
  on repositories(last_snapshot_at desc);
create index if not exists idx_repositories_small_updated
  on repositories(updated_at desc) where stars >= 20 and stars < 5000;
create index if not exists idx_repositories_early_created
  on repositories(created_at desc) where stars < 2000;

-- snapshots_repo_time_idx from 001_initial_schema.sql already provides the
-- requested (repository_id, captured_at desc) index, so it is not duplicated.

create table if not exists candidate_recall_status (
  id boolean primary key default true check (id),
  source_counts jsonb not null default '{}'::jsonb,
  candidate_count integer not null default 0,
  deduplicated_count integer not null default 0,
  computed_at timestamptz not null default now()
);
alter table candidate_recall_status enable row level security;

create or replace function get_repository_snapshot_metrics(
  candidate_ids uuid[] default null
)
returns table (
  repository_id uuid,
  current_stars integer,
  stars_1h integer,
  stars_6h integer,
  stars_24h integer,
  stars_7d integer,
  stars_30d integer,
  relative_growth_24h double precision,
  velocity double precision,
  velocity_source text,
  acceleration double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with selected as materialized (
    select r.id, r.stars
    from repositories r
    where not r.archived
      and (candidate_ids is null or r.id = any(candidate_ids))
  ), points as (
    select
      r.id,
      r.stars as repo_stars,
      latest.stars as latest_stars,
      h1.stars as stars_at_1h,
      h6.stars as stars_at_6h,
      h24.stars as stars_at_24h,
      h48.stars as stars_at_48h,
      d7.stars as stars_at_7d,
      d30.stars as stars_at_30d
    from selected r
    left join lateral (
      select s.stars, s.captured_at
      from repository_snapshots s
      where s.repository_id = r.id
      order by s.captured_at desc
      limit 1
    ) latest on true
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '1 hour'
        and s.captured_at >= latest.captured_at - interval '3 hours'
      order by s.captured_at desc
      limit 1
    ) h1 on latest.captured_at is not null
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '6 hours'
        and s.captured_at >= latest.captured_at - interval '10 hours'
      order by s.captured_at desc
      limit 1
    ) h6 on latest.captured_at is not null
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '24 hours'
        and s.captured_at >= latest.captured_at - interval '32 hours'
      order by s.captured_at desc
      limit 1
    ) h24 on latest.captured_at is not null
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '48 hours'
        and s.captured_at >= latest.captured_at - interval '56 hours'
      order by s.captured_at desc
      limit 1
    ) h48 on latest.captured_at is not null
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '7 days'
        and s.captured_at >= latest.captured_at - interval '8 days'
      order by s.captured_at desc
      limit 1
    ) d7 on latest.captured_at is not null
    left join lateral (
      select s.stars
      from repository_snapshots s
      where s.repository_id = r.id
        and s.captured_at <= latest.captured_at - interval '30 days'
        and s.captured_at >= latest.captured_at - interval '33 days'
      order by s.captured_at desc
      limit 1
    ) d30 on latest.captured_at is not null
  ), metrics as (
    select
      id,
      repo_stars,
      latest_stars,
      case when stars_at_1h is null then null else latest_stars - stars_at_1h end as growth_1h,
      case when stars_at_6h is null then null else latest_stars - stars_at_6h end as growth_6h,
      case when stars_at_24h is null then null else latest_stars - stars_at_24h end as growth_24h,
      case when stars_at_7d is null then null else latest_stars - stars_at_7d end as growth_7d,
      case when stars_at_30d is null then null else latest_stars - stars_at_30d end as growth_30d,
      case when stars_at_24h is null or stars_at_48h is null then null
        else stars_at_24h - stars_at_48h end as previous_growth_24h
    from points
  )
  select
    id,
    repo_stars,
    growth_1h,
    growth_6h,
    growth_24h,
    growth_7d,
    growth_30d,
    case when growth_24h is null then null
      else growth_24h::double precision / greatest(repo_stars - growth_24h, 1) end,
    case
      when growth_24h is not null then growth_24h::double precision / 24
      when growth_6h is not null then growth_6h::double precision / 6
      when growth_1h is not null then growth_1h::double precision
      else null
    end,
    case
      when growth_24h is not null then '24h'
      when growth_6h is not null then '6h'
      when growth_1h is not null then '1h'
      else null
    end,
    case
      when growth_24h is null or previous_growth_24h is null then null
      when previous_growth_24h = 0 and growth_24h > 0 then 2::double precision
      when previous_growth_24h = 0 then 1::double precision
      else growth_24h::double precision / previous_growth_24h
    end
  from metrics;
$$;

create or replace function get_opportunity_metric_recall()
returns table (
  repository_id uuid,
  recall_source text,
  current_stars integer,
  stars_1h integer,
  stars_6h integer,
  stars_24h integer,
  stars_7d integer,
  stars_30d integer,
  relative_growth_24h double precision,
  velocity double precision,
  velocity_source text,
  acceleration double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with metrics as materialized (
    select * from get_repository_snapshot_metrics(null::uuid[])
  ), star_spike as (
    select * from metrics
    where stars_6h >= 10 or stars_24h >= 20
    order by coalesce(stars_24h, 0) desc, coalesce(relative_growth_24h, 0) desc
    limit 500
  ), accelerating as (
    select * from metrics
    where acceleration >= 1.5
    order by acceleration desc, coalesce(stars_24h, 0) desc
    limit 300
  ), relative_growth as (
    select * from metrics
    where relative_growth_24h >= 0.03 and current_stars < 10000
    order by relative_growth_24h desc, coalesce(stars_24h, 0) desc
    limit 300
  )
  select repository_id, 'star_spike'::text, current_stars, stars_1h, stars_6h,
    stars_24h, stars_7d, stars_30d, relative_growth_24h, velocity,
    velocity_source, acceleration from star_spike
  union all
  select repository_id, 'high_acceleration'::text, current_stars, stars_1h,
    stars_6h, stars_24h, stars_7d, stars_30d, relative_growth_24h,
    velocity, velocity_source, acceleration from accelerating
  union all
  select repository_id, 'high_relative_growth'::text, current_stars, stars_1h,
    stars_6h, stars_24h, stars_7d, stars_30d, relative_growth_24h,
    velocity, velocity_source, acceleration from relative_growth;
$$;

revoke all on function get_repository_snapshot_metrics(uuid[]) from public, anon, authenticated;
revoke all on function get_opportunity_metric_recall() from public, anon, authenticated;
grant execute on function get_repository_snapshot_metrics(uuid[]) to service_role;
grant execute on function get_opportunity_metric_recall() to service_role;
grant select, insert, update on candidate_recall_status to service_role;
