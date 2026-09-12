'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Database,
  GitFork,
  RefreshCw,
  Radar,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = {
  github: '正常' | '异常';
  supabase: '正常' | '异常';
  repository_count: number;
  snapshot_count: number;
  last_discovery_at: string | null;
  last_snapshot_at: string | null;
  github_rate_limit: { remaining: number; limit: number; reset: string } | null;
  recent_error: string | null;
  recall_status: {
    source_counts: Record<string, number>;
    candidate_count: number;
    deduplicated_count: number;
    computed_at: string;
  } | null;
};
const showTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN') : '尚未运行';

export default function DataStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<'discover' | 'snapshot' | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/data-status', {
        cache: 'no-store',
      });
      const body = (await response.json()) as Status & { error?: string };
      if (!response.ok) throw new Error(body.error || '读取失败');
      setStatus(body);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const run = async (action: 'discover' | 'snapshot') => {
    setRunning(action);
    setError(null);
    try {
      const response = await fetch('/api/admin/data-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || '执行失败');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(null);
    }
  };
  return (
    <main className="min-h-screen bg-[#0b0d12] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center gap-4">
          <Link
            className="grid size-9 place-items-center rounded-md border border-white/10 text-zinc-500 hover:text-white"
            href="/"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="mono text-[10px] uppercase tracking-[.2em] text-cyan-400">
              ADMIN / REAL DATA PIPELINE
            </div>
            <h1 className="mt-1 text-2xl font-semibold">数据采集状态</h1>
          </div>
          <Button
            className="ml-auto"
            onClick={() => void load()}
            size="icon"
            variant="ghost"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Link
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-cyan-200"
            href="/admin/candidates"
          >
            查看候选调试
          </Link>
        </header>
        {error && (
          <div className="mb-5 rounded-md border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [GitFork, 'GitHub API', status?.github ?? '检查中'],
              [Database, 'Supabase', status?.supabase ?? '检查中'],
              [
                Radar,
                '监控仓库',
                status ? status.repository_count.toLocaleString() : '—',
              ],
              [
                Database,
                'Snapshot 总数',
                status ? status.snapshot_count.toLocaleString() : '—',
              ],
            ] as Array<[LucideIcon, string, ReactNode]>
          ).map(([Icon, label, value]) => (
            <div className="panel p-5" key={String(label)}>
              <Icon className="size-4 text-cyan-300" />
              <div className="mt-5 mono text-2xl">{value}</div>
              <div className="mt-1 text-xs text-zinc-600">{label}</div>
            </div>
          ))}
        </section>
        <section className="panel mt-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">多路召回统计</h2>
            <span className="mono text-xs text-zinc-600">
              {status?.recall_status
                ? showTime(status.recall_status.computed_at)
                : '尚未计算'}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Recent Created', 'recent_created'],
              ['Recent Active', 'recent_active'],
              ['Small Repo', 'small_repo'],
              ['Early Stage', 'early_stage'],
              ['Star Spike', 'star_spike'],
              ['Acceleration', 'high_acceleration'],
              ['Relative Growth', 'high_relative_growth'],
            ].map(([label, key]) => (
              <div
                className="rounded-md border border-white/[.06] p-3"
                key={key}
              >
                <div className="mono text-lg text-zinc-200">
                  {status?.recall_status?.source_counts[key] ?? '—'}
                </div>
                <div className="mt-1 text-xs text-zinc-600">{label}</div>
              </div>
            ))}
            <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[.04] p-3">
              <div className="mono text-lg text-cyan-300">
                {status?.recall_status?.deduplicated_count ?? '—'}
              </div>
              <div className="mt-1 text-xs text-zinc-600">去重后</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-zinc-500">
            本轮候选仓库：
            <span className="ml-2 mono text-zinc-200">
              {status?.recall_status?.candidate_count ?? '—'}
            </span>
          </div>
        </section>
        <section className="panel mt-5 p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-xs text-zinc-600">最近 Discovery</div>
              <div className="mt-2 mono text-sm">
                {showTime(status?.last_discovery_at ?? null)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-600">最近 Snapshot</div>
              <div className="mt-2 mono text-sm">
                {showTime(status?.last_snapshot_at ?? null)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-600">GitHub API 剩余额度</div>
              <div className="mt-2 mono text-sm">
                {status?.github_rate_limit
                  ? `${status.github_rate_limit.remaining} / ${status.github_rate_limit.limit}`
                  : '不可用'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-600">额度重置时间</div>
              <div className="mt-2 mono text-sm">
                {showTime(status?.github_rate_limit?.reset ?? null)}
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-white/[.07] pt-5">
            <div className="text-xs text-zinc-600">最近错误</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/20 p-3 text-xs text-zinc-400">
              {status?.recent_error ?? '无'}
            </pre>
          </div>
        </section>
        <section className="panel mt-5 flex flex-col gap-3 p-5 sm:flex-row">
          <Button
            className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            disabled={running !== null}
            onClick={() => void run('discover')}
          >
            {running === 'discover' && <RefreshCw className="animate-spin" />}
            立即发现项目
          </Button>
          <Button
            disabled={running !== null}
            onClick={() => void run('snapshot')}
            variant="outline"
          >
            {running === 'snapshot' && <RefreshCw className="animate-spin" />}
            立即采集 Snapshot
          </Button>
          <p className="self-center text-xs text-zinc-600">
            操作会调用真实 Collector；完成后本页自动刷新。
          </p>
        </section>
      </div>
    </main>
  );
}
