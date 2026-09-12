alter table repositories enable row level security;
alter table repository_snapshots enable row level security;
alter table keyword_monitors enable row level security;
alter table repository_keyword_matches enable row level security;
alter table collector_runs enable row level security;

-- No anon/authenticated policies are intentional: all database access goes through
-- server-only routes using the service-role key, which bypasses RLS.
