'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  RepositoryApiResponse,
  RepositoryOpportunity,
} from '@/lib/repositories';

type SortKey = 'score' | 'stars' | 'growth' | 'relative' | 'acceleration';
const numberOrBottom = (value: number | null) =>
  value ?? Number.NEGATIVE_INFINITY;

export default function CandidateDebugPage() {
  const [response, setResponse] = useState<RepositoryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('score');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/admin/candidates', {
        cache: 'no-store',
      });
      const body = (await result.json()) as RepositoryApiResponse & {
        error?: string;
      };
      if (!result.ok) throw new Error(body.error || '读取失败');
      setResponse(body);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const rows = useMemo(() => {
    const values = [...(response?.data ?? [])];
    return values.sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars;
      if (sort === 'growth')
        return numberOrBottom(b.stars_24h) - numberOrBottom(a.stars_24h);
      if (sort === 'relative')
        return (
          numberOrBottom(b.relative_growth_24h) -
          numberOrBottom(a.relative_growth_24h)
        );
      if (sort === 'acceleration')
        return numberOrBottom(b.acceleration) - numberOrBottom(a.acceleration);
      return b.opportunity_score - a.opportunity_score;
    });
  }, [response, sort]);
  return (
    <main className="min-h-screen bg-[#0b0d12] p-4 sm:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            aria-label="返回数据状态"
            className="grid size-9 place-items-center rounded-md border border-white/10 text-zinc-500 hover:text-white"
            href="/admin/data-status"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="mono text-[10px] uppercase tracking-[.2em] text-cyan-400">
              ADMIN / MULTI-RECALL DEBUG
            </div>
            <h1 className="mt-1 text-2xl font-semibold">候选仓库调试</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="候选排序"
              className="h-9 rounded-md border border-white/10 bg-[#11141b] px-3 text-xs"
              onChange={(event) => setSort(event.target.value as SortKey)}
              value={sort}
            >
              <option value="score">Opportunity Score</option>
              <option value="growth">Stars 24h</option>
              <option value="relative">Relative Growth 24h</option>
              <option value="acceleration">Acceleration</option>
              <option value="stars">Total Stars</option>
            </select>
            <Button
              disabled={loading}
              onClick={() => void load()}
              size="icon"
              variant="ghost"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </header>
        {error ? (
          <div className="panel p-8 text-center text-sm text-rose-300">
            {error}
          </div>
        ) : (
          <section className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-xs">
                <thead className="border-b border-white/[.07] bg-black/10 text-zinc-500">
                  <tr>
                    <th className="p-3">Repo</th>
                    <th>Stars</th>
                    <th>Stars 24h</th>
                    <th>Relative 24h</th>
                    <th>Acceleration</th>
                    <th>Score</th>
                    <th>Recall Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((repo: RepositoryOpportunity) => (
                    <tr className="border-b border-white/[.055]" key={repo.id}>
                      <td className="p-3">
                        <Link
                          className="hover:text-cyan-300"
                          href={`/repo/${repo.owner}/${repo.name}`}
                        >
                          {repo.full_name}
                        </Link>
                      </td>
                      <td className="mono">{repo.stars.toLocaleString()}</td>
                      <td className="mono">
                        {repo.stars_24h === null
                          ? '采集中'
                          : `${repo.stars_24h >= 0 ? '+' : ''}${repo.stars_24h}`}
                      </td>
                      <td className="mono">
                        {repo.relative_growth_24h === null
                          ? '采集中'
                          : `${(repo.relative_growth_24h * 100).toFixed(2)}%`}
                      </td>
                      <td className="mono">
                        {repo.acceleration === null
                          ? '采集中'
                          : `${repo.acceleration.toFixed(2)}×`}
                      </td>
                      <td className="mono text-lg text-cyan-300">
                        {repo.opportunity_score}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {repo.recall_sources.map((source) => (
                            <span
                              className="rounded bg-white/[.05] px-1.5 py-1 mono text-[10px] text-zinc-400"
                              key={source}
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !rows.length && (
              <div className="p-12 text-center text-sm text-zinc-600">
                暂无候选仓库
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
