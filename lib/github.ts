const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, { expires: number; value: unknown }>();
export type GitHubRateLimit = {
  remaining: number | null;
  limit: number | null;
  reset: string | null;
  resource: string | null;
};
let lastRateLimit: GitHubRateLimit = {
  remaining: null,
  limit: null,
  reset: null,
  resource: null,
};
export function getLastGitHubRateLimit() {
  return lastRateLimit;
}
export async function githubRequest<T>(
  path: string,
  init: RequestInit = {},
  ttlMs = 300000,
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured');
  const key = `${init.method ?? 'GET'}:${path}`,
    hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'github-opportunity-monitor');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers,
    });
    console.info('github_rate_limit', {
      remaining: res.headers.get('x-ratelimit-remaining'),
      reset: res.headers.get('x-ratelimit-reset'),
      resource: res.headers.get('x-ratelimit-resource'),
    });
    lastRateLimit = {
      remaining: Number(res.headers.get('x-ratelimit-remaining')) || 0,
      limit: Number(res.headers.get('x-ratelimit-limit')) || 0,
      reset: res.headers.get('x-ratelimit-reset')
        ? new Date(
            Number(res.headers.get('x-ratelimit-reset')) * 1000,
          ).toISOString()
        : null,
      resource: res.headers.get('x-ratelimit-resource'),
    };
    if (res.ok) {
      const value = (await res.json()) as T;
      cache.set(key, { expires: Date.now() + ttlMs, value });
      return value;
    }
    if (![403, 429, 500, 502, 503, 504].includes(res.status))
      throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const reset =
      Number(res.headers.get('x-ratelimit-reset')) * 1000 - Date.now();
    await sleep(
      Math.max(500, Math.min(reset > 0 ? reset : 500 * 2 ** attempt, 30000)),
    );
  }
  throw new Error('GitHub retries exhausted');
}
export type GitHubRepository = {
  id: number;
  owner: { login: string };
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  archived: boolean;
  created_at: string;
  pushed_at: string;
};
export async function searchRepositories(
  query: string,
  page = 1,
  sort: 'stars' | 'updated' = 'stars',
) {
  return githubRequest<{ items: GitHubRepository[] }>(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=50&page=${page}`,
    {},
    120000,
  );
}

export async function checkGitHub() {
  const result = await githubRequest<{
    resources: { core: { remaining: number; limit: number; reset: number } };
  }>('/rate_limit', {}, 30_000);
  return {
    remaining: result.resources.core.remaining,
    limit: result.resources.core.limit,
    reset: new Date(result.resources.core.reset * 1000).toISOString(),
  };
}
