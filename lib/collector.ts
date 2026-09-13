/* oxlint-disable typescript/no-explicit-any */
import {
  getLastGitHubRateLimit,
  githubRequest,
  searchRepositories,
  type GitHubRepository,
} from './github';
import {
  buildDiscoveryPlans,
  classifyRepository,
  type DiscoveryTier,
} from './discovery';
import type { DiscoverySource } from './repositories';
import { supabaseRequest } from './supabase';

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

function toRow(
  repository: GitHubRepository,
  sources: Iterable<DiscoverySource>,
  existingSources: DiscoverySource[] = [],
) {
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
    category: classifyRepository(repository),
    discovery_sources: [...new Set([...existingSources, ...sources])],
    archived: repository.archived,
    created_at: repository.created_at,
    pushed_at: repository.pushed_at,
    updated_at: capturedAt,
    last_snapshot_at: capturedAt,
  };
}

export async function discover() {
  const runId = await recordRun('discover', 'running', {});
  const found = new Map<
    number,
    { repository: GitHubRepository; sources: Set<DiscoverySource> }
  >();
  const errors: string[] = [];
  let requests = 0;
  try {
    const plans = buildDiscoveryPlans();
    const sourceRepositoryIds = new Map<DiscoverySource, Set<number>>();
    const tierRequestCounts: Record<DiscoveryTier, number> = {
      global: 0,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };
    let shouldStop = false;
    for (const plan of plans) {
      if (shouldStop) break;
      for (let page = 1; page <= plan.pages; page++) {
        const rate = getLastGitHubRateLimit();
        if (
          rate.resource === 'search' &&
          rate.remaining !== null &&
          rate.remaining <= 2
        ) {
          errors.push('GitHub Search rate limit 接近耗尽，本轮已提前停止');
          shouldStop = true;
          break;
        }
        try {
          const result = await searchRepositories(plan.query, page, plan.sort);
          requests++;
          tierRequestCounts[plan.tier]++;
          for (const repository of result.items) {
            const sourceIds = sourceRepositoryIds.get(plan.source) ?? new Set();
            sourceIds.add(repository.id);
            sourceRepositoryIds.set(plan.source, sourceIds);
            const hit = found.get(repository.id) ?? {
              repository,
              sources: new Set<DiscoverySource>(),
            };
            hit.repository = repository;
            hit.sources.add(plan.source);
            found.set(repository.id, hit);
          }
          if (result.items.length < 50) break;
        } catch (error) {
          errors.push(`${plan.query} page=${page}: ${String(error)}`);
          break;
        }
      }
    }
    const existingSources = new Map<number, DiscoverySource[]>();
    const githubIds = [...found.keys()];
    for (let start = 0; start < githubIds.length; start += 100) {
      const existing = await supabaseRequest<
        Array<{ github_id: number; discovery_sources: DiscoverySource[] }>
      >(
        `repositories?select=github_id,discovery_sources&github_id=in.(${githubIds.slice(start, start + 100).join(',')})`,
      );
      for (const row of existing)
        existingSources.set(row.github_id, row.discovery_sources ?? []);
    }
    const rows = [...found.values()].map(({ repository, sources }) =>
      toRow(repository, sources, existingSources.get(repository.id)),
    );
    const sourceCounts = Object.fromEntries(
      [...sourceRepositoryIds].map(([source, ids]) => [source, ids.size]),
    ) as Partial<Record<DiscoverySource, number>>;
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
        query_group: new Date().getUTCHours(),
        discovery_source_counts: sourceCounts,
        query_tier_counts: tierRequestCounts,
        error_message: errors.length ? errors.slice(-5).join('\n') : null,
        rate_limit_remaining: rate.remaining,
        rate_limit_reset: rate.reset,
      },
      runId,
    );
    return {
      discovered: rows.length,
      requests,
      errors: errors.length,
      global_requests: tierRequestCounts.global,
      topic_requests:
        tierRequestCounts.A +
        tierRequestCounts.B +
        tierRequestCounts.C +
        tierRequestCounts.D,
      tier_requests: tierRequestCounts,
      source_counts: sourceCounts,
    };
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
        archived: data.archived,
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
