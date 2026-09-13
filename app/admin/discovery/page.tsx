'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  DiscoverySource,
  RepositoryApiResponse,
  RepositoryCategory,
} from '@/lib/repositories';

export default function DiscoveryDebugPage() {
  const [response, setResponse] = useState<RepositoryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [source, setSource] = useState('All');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/admin/discovery', { cache: 'no-store' });
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
  const categories = useMemo(
    () => [
      'All',
      ...new Set((response?.data ?? []).map((repo) => repo.category)),
    ],
    [response],
  );
  const sources = useMemo(
    () => [
      'All',
      ...new Set(
        (response?.data ?? []).flatMap((repo) => repo.discovery_sources),
      ),
    ],
    [response],
  );
  const rows = useMemo(
    () =>
      (response?.data ?? []).filter(
        (repo) =>
          (category === 'All' || repo.category === category) &&
          (source === 'All' ||
            repo.discovery_sources.includes(source as DiscoverySource)),
      ),
    [category, response, source],
  );
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
              ADMIN / DISCOVERY SOURCE DEBUG
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Discovery 调试</h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              aria-label="按 Category 筛选"
              className="h-9 rounded-md border border-white/10 bg-[#11141b] px-3 text-xs"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="按 Discovery Source 筛选"
              className="h-9 rounded-md border border-white/10 bg-[#11141b] px-3 text-xs"
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              {sources.map((value) => (
                <option key={value}>{value}</option>
              ))}
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
              <table className="w-full min-w-[1200px] text-left text-xs">
                <thead className="border-b border-white/[.07] bg-black/10 text-zinc-500">
                  <tr>
                    <th className="p-3">Repo</th>
                    <th>Category</th>
                    <th>Discovery Sources</th>
                    <th>Stars</th>
                    <th>Created At</th>
                    <th>Opportunity</th>
                    <th>Recall Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((repo) => (
                    <tr className="border-b border-white/[.055]" key={repo.id}>
                      <td className="p-3">
                        <Link
                          className="hover:text-cyan-300"
                          href={`/repo/${repo.owner}/${repo.name}`}
                        >
                          {repo.full_name}
                        </Link>
                      </td>
                      <td>
                        <span className="rounded bg-cyan-300/[.07] px-2 py-1 text-cyan-200">
                          {repo.category as RepositoryCategory}
                        </span>
                      </td>
                      <td>
                        <div className="flex max-w-md flex-wrap gap-1">
                          {repo.discovery_sources.map((value) => (
                            <span
                              className="rounded bg-white/[.05] px-1.5 py-1 mono text-[10px] text-zinc-400"
                              key={value}
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="mono">{repo.stars.toLocaleString()}</td>
                      <td className="mono text-zinc-500">
                        {new Date(repo.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="mono text-lg text-cyan-300">
                        {repo.opportunity_score}
                      </td>
                      <td>
                        <div className="flex max-w-md flex-wrap gap-1">
                          {repo.recall_sources.map((value) => (
                            <span
                              className="rounded bg-white/[.05] px-1.5 py-1 mono text-[10px] text-zinc-400"
                              key={value}
                            >
                              {value}
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
                暂无符合筛选条件的 Discovery 记录
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
