import { searchRepositories, githubRequest } from './github';
/* oxlint-disable typescript/no-explicit-any */
import { supabaseRequest } from './supabase';
export async function discover() {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const { items } = await searchRepositories(
    `created:>${since} stars:>20 archived:false`,
  );
  const rows = items.map((r: any) => ({
    github_id: r.id,
    owner: r.owner.login,
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    github_url: r.html_url,
    stars: r.stargazers_count,
    forks: r.forks_count,
    open_issues: r.open_issues_count,
    primary_language: r.language,
    topics: r.topics ?? [],
    created_at: r.created_at,
    pushed_at: r.pushed_at,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length)
    await supabaseRequest('repositories?on_conflict=github_id', 'POST', rows);
  return { discovered: rows.length };
}
export async function snapshot(limit = 250) {
  const repos = await supabaseRequest<
    Array<{ id: string; owner: string; name: string }>
  >(
    `repositories?select=id,owner,name&order=last_snapshot_at.asc.nullsfirst&limit=${limit}`,
  );
  let stored = 0;
  for (const repo of repos) {
    const r = await githubRequest<any>(
      `/repos/${repo.owner}/${repo.name}`,
      {},
      60000,
    );
    await supabaseRequest('repository_snapshots', 'POST', {
      repository_id: repo.id,
      stars: r.stargazers_count,
      forks: r.forks_count,
      open_issues: r.open_issues_count,
      captured_at: new Date().toISOString(),
    });
    await supabaseRequest(`repositories?id=eq.${repo.id}`, 'PATCH', {
      stars: r.stargazers_count,
      forks: r.forks_count,
      open_issues: r.open_issues_count,
      pushed_at: r.pushed_at,
      last_snapshot_at: new Date().toISOString(),
    });
    stored++;
  }
  return { stored };
}
