alter table collector_runs
  add column if not exists query_group smallint;
