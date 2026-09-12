const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, { expires: number; value: unknown }>();
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
  created_at: string;
  pushed_at: string;
};
export async function searchRepositories(query: string, page = 1) {
  return githubRequest<{ items: GitHubRepository[] }>(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=50&page=${page}`,
    {},
    120000,
  );
}
