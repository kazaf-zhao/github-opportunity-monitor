/* oxlint-disable typescript/no-explicit-any */
import {
  getLastGitHubRateLimit,
  githubRequest,
  searchRepositories,
  type GitHubRepository,
} from './github';
import { supabaseRequest } from './supabase';

const KEYWORDS = [
  'AI Agent',
  'MCP',
  'LLM',
  'RAG',
  'Browser Agent',
  'Computer Use',
  'Developer Tools',
  'Crypto',
  'Trading',
  'Prediction Market',
  'Stablecoin',
  'Database',
  'Infrastructure',
  'Automation',
  'Productivity',
];

async function recordRun(
  job: 'discover' | 'snapshot',
  status: 'running' | 'success' | 'partial' | 'failed',
  details: Record<string, unknown>,
  id?: string,
) {
  try {
    if (id) {
      await supabaseRequest(`collector_runs?id=eq.${id}`, 'PATCH', {
        status,
        completed_at: status === 'running' ? null : new Date().toISOString(),
        ...details,
      });
      return id;
    }
    const rows = await supabaseRequest<Array<{ id: string }>>(
      'collector_runs',
      'POST',
      { job, status, started_at: new Date().toISOString(), ...details },
    );
    return rows[0]?.id;
  } catch (error) {
    console.warn('collector_run_log_failed', error);
    return id;
  }
}

function queryPlans() {
  const windows = [7, 30, 90];
  const minimumStars = [10, 50, 100];
  return KEYWORDS.map((keyword, index) => {
    const days = windows[index % windows.length];
    const stars = minimumStars[index % minimumStars.length];
    const date = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const recentActivity = index % 4 === 3;
    return {
      query: `"${keyword}" ${recentActivity ? `pushed:>${date}` : `created:>${date}`} stars:>${stars} archived:false`,
      sort: recentActivity ? ('updated' as const) : ('stars' as const),
    };
  });
}

function toRow(repository: GitHubRepository) {
  const capturedAt = new Date().toISOString();
  return {
    github_id: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    full_name: repository.full_name,
    description: repository.description,
    github_url: repository.html_url,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    open_issues: repository.open_issues_count,
    primary_language: repository.language,
    topics: repository.topics ?? [],
    created_at: repository.created_at,
    pushed_at: repository.pushed_at,
    updated_at: capturedAt,
    last_snapshot_at: capturedAt,
  };
}

export async function discover() {
  const runId = await recordRun('discover', 'running', {});
  const found = new Map<number, GitHubRepository>();
  const errors: string[] = [];
  let requests = 0;
  try {
    for (const plan of queryPlans()) {
      for (let page = 1; page <= 2; page++) {
        const rate = getLastGitHubRateLimit();
        if (
          rate.resource === 'search' &&
          rate.remaining !== null &&
          rate.remaining <= 2
        ) {
          errors.push('GitHub Search rate limit 接近耗尽，本轮已提前停止');
          break;
        }
        try {
          const result = await searchRepositories(plan.query, page, plan.sort);
          requests++;
          for (const repository of result.items)
            found.set(repository.id, repository);
          if (result.items.length < 50) break;
        } catch (error) {
          errors.push(`${plan.query} page=${page}: ${String(error)}`);
          break;
        }
      }
    }
    const rows = [...found.values()].map(toRow);
    const storedRows: Array<{
      id: string;
      stars: number;
      forks: number;
      open_issues: number;
      last_snapshot_at: string;
    }> = [];
    for (let start = 0; start < rows.length; start += 100) {
      const batch = await supabaseRequest<typeof storedRows>(
        'repositories?on_conflict=github_id',
        'POST',
        rows.slice(start, start + 100),
        'resolution=merge-duplicates,return=representation',
      );
      storedRows.push(...batch);
    }
    for (let start = 0; start < storedRows.length; start += 250) {
      await supabaseRequest(
        'repository_snapshots',
        'POST',
        storedRows.slice(start, start + 250).map((row) => ({
          repository_id: row.id,
          stars: row.stars,
          forks: row.forks,
          open_issues: row.open_issues,
          captured_at: row.last_snapshot_at,
        })),
      );
    }
    const rate = getLastGitHubRateLimit();
    await recordRun(
      'discover',
      errors.length ? 'partial' : 'success',
      {
        processed_count: rows.length,
        request_count: requests,
        error_message: errors.length ? errors.slice(-5).join('\n') : null,
        rate_limit_remaining: rate.remaining,
        rate_limit_reset: rate.reset,
      },
      runId,
    );
    return { discovered: rows.length, requests, errors: errors.length };
  } catch (error) {
    await recordRun(
      'discover',
      'failed',
      { error_message: String(error) },
      runId,
    );
    throw error;
  }
}

export async function snapshot(limit = 250) {
  const runId = await recordRun('snapshot', 'running', {});
  const repos = await supabaseRequest<
    Array<{ id: string; owner: string; name: string }>
  >(
    `repositories?select=id,owner,name&order=last_snapshot_at.asc.nullsfirst&limit=${limit}`,
  );
  let stored = 0;
  const errors: string[] = [];
  for (const repo of repos) {
    try {
      const data = await githubRequest<any>(
        `/repos/${repo.owner}/${repo.name}`,
        {},
        60_000,
      );
      const capturedAt = new Date().toISOString();
      await supabaseRequest('repository_snapshots', 'POST', {
        repository_id: repo.id,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        captured_at: capturedAt,
      });
      await supabaseRequest(`repositories?id=eq.${repo.id}`, 'PATCH', {
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        pushed_at: data.pushed_at,
        updated_at: capturedAt,
        last_snapshot_at: capturedAt,
      });
      stored++;
    } catch (error) {
      errors.push(`${repo.owner}/${repo.name}: ${String(error)}`);
    }
  }
  const rate = getLastGitHubRateLimit();
  await recordRun(
    'snapshot',
    errors.length ? 'partial' : 'success',
    {
      processed_count: stored,
      error_message: errors.length ? errors.slice(-10).join('\n') : null,
      rate_limit_remaining: rate.remaining,
      rate_limit_reset: rate.reset,
    },
    runId,
  );
  return { stored, failed: errors.length };
}
