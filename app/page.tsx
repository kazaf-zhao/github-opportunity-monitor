'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Binoculars,
  BookMarked,
  CircleDot,
  Database,
  Flame,
  Gauge,
  GitFork,
  LayoutDashboard,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  signalStyles,
  signalZh,
  type RepositoryApiResponse,
  type RepositoryOpportunity,
} from '@/lib/repositories';

const categories = [
  'All',
  'AI',
  'Agents',
  'MCP',
  'Developer Tools',
  'Data',
  'Infrastructure',
  'Security',
  'Productivity',
  'Finance',
  'Crypto/Web3',
  'Trading',
  'Science',
  'Robotics',
  'Media',
  'Other',
];
const categoryZh: Record<string, string> = {
  All: '全部',
  AI: '人工智能',
  Agents: '智能体',
  MCP: 'MCP',
  'Developer Tools': '开发工具',
  'Crypto/Web3': '加密/Web3',
  Trading: '交易',
  Data: '数据',
  Infrastructure: '基础设施',
  Productivity: '效率工具',
  Security: '安全',
  Finance: '金融科技',
  Science: '科学计算',
  Robotics: '机器人',
  Media: '媒体',
  Other: '其他',
};
const sortOptions = [
  'Opportunity Score',
  '24h Star Growth',
  '7d Star Growth',
  'Total Stars',
  'Repository Age',
];
const sortZh: Record<string, string> = {
  'Opportunity Score': '异动优先（机会评分）',
  '24h Star Growth': '24 小时 Star 增长',
  '7d Star Growth': '7 天 Star 增长',
  'Total Stars': 'Star 总数',
  'Repository Age': '仓库年龄',
};

function relativeTime(value: string | null, zh: boolean) {
  if (!value) return zh ? '等待首次快照' : 'Waiting for first snapshot';
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return zh ? `${days} 天前` : `${days}d ago`;
}

function Spark({ data }: { data: number[] }) {
  if (data.length < 2)
    return <span className="text-[10px] text-zinc-600">历史数据采集中</span>;
  const max = Math.max(...data),
    min = Math.min(...data);
  const points = data
    .map(
      (value, index) =>
        `${(index / (data.length - 1)) * 104},${28 - ((value - min) / (max - min || 1)) * 24}`,
    )
    .join(' ');
  return (
    <svg
      aria-label="真实 Star 快照趋势"
      height="30"
      viewBox="0 0 104 30"
      width="104"
    >
      <polyline
        fill="none"
        points={points}
        stroke="#67e8f9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <strong
        className={`mono text-2xl ${value >= 80 ? 'text-cyan-300' : value >= 60 ? 'text-emerald-300' : 'text-amber-300'}`}
      >
        {value}
      </strong>
      <Progress
        className="hidden h-1 w-10 bg-white/10 xl:block"
        value={value}
      />
    </div>
  );
}

function Growth({ value, suffix }: { value: number | null; suffix: string }) {
  return value === null ? (
    <span className="text-[10px] text-zinc-600">采集中</span>
  ) : (
    <span className="mono text-xs text-emerald-300">
      {value >= 0 ? '+' : ''}
      {value.toLocaleString()} <span className="text-zinc-600">{suffix}</span>
    </span>
  );
}

function RelativeGrowth({ value, zh }: { value: number | null; zh: boolean }) {
  return value === null ? (
    <span className="text-[10px] text-zinc-600">
      {zh ? '增长率采集中' : 'Growth rate collecting'}
    </span>
  ) : (
    <span className="mono text-[10px] text-violet-300">
      {value >= 0 ? '+' : ''}
      {(value * 100).toFixed(1)}% / 24h
    </span>
  );
}

function Sidebar({
  response,
  zh,
}: {
  response: RepositoryApiResponse | null;
  zh: boolean;
}) {
  const status = response?.meta.data_status ?? 'WAITING';
  const statusColor =
    status === 'LIVE'
      ? 'bg-emerald-400'
      : status === 'RECENT'
        ? 'bg-amber-400'
        : 'bg-rose-400';
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] border-r border-white/[.07] bg-[#080a0e] lg:block">
      <div className="flex h-[68px] items-center gap-3 border-b border-white/[.07] px-5">
        <div className="grid size-8 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
          <TrendingUp className="size-4 text-cyan-300" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">
            {zh ? '机会雷达' : 'OPPORTUNITY'}
          </div>
          <div className="mono text-[9px] tracking-[.2em] text-zinc-500">
            GITHUB MONITOR
          </div>
        </div>
      </div>
      <nav className="space-y-1 px-3 py-5 text-sm">
        <div className="mb-2 px-3 mono text-[10px] uppercase tracking-[.18em] text-zinc-600">
          {zh ? '工作台' : 'Workspace'}
        </div>
        <Link
          className="flex items-center gap-3 rounded-md border border-cyan-400/10 bg-cyan-400/[.08] px-3 py-2.5 font-medium text-cyan-200"
          href="/"
        >
          <LayoutDashboard className="size-4" />
          {zh ? '发现' : 'Discover'}
          <span className="ml-auto mono text-[10px]">
            {response?.data.length ?? '—'}
          </span>
        </Link>
        <Link className="nav-item" href="/watchlist">
          <BookMarked className="size-4" />
          {zh ? '关键词监控' : 'Watchlist'}
        </Link>
        <Link className="nav-item" href="/admin/data-status">
          <Database className="size-4" />
          {zh ? '数据采集' : 'Collectors'}
        </Link>
      </nav>
      <div className="absolute inset-x-3 bottom-4 rounded-lg border border-white/[.07] bg-white/[.025] p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
          <span className={`size-2 rounded-full ${statusColor}`} />
          {status === 'LIVE' ? (zh ? '系统运行正常' : 'System live') : status}
        </div>
        <div className="mono text-[10px] leading-5 text-zinc-600">
          {zh ? '最近快照：' : 'Last snapshot: '}
          {relativeTime(response?.meta.last_snapshot_at ?? null, zh)}
          <br />
          {zh ? '正在监控：' : 'Monitoring: '}
          {response?.meta.repository_count?.toLocaleString() ?? '—'}{' '}
          {zh ? '个仓库' : 'repositories'}
        </div>
      </div>
    </aside>
  );
}

function RepoRow({
  repo,
  index,
  zh,
}: {
  repo: RepositoryOpportunity;
  index: number;
  zh: boolean;
}) {
  return (
    <tr className="border-b border-white/[.055] hover:bg-white/[.025]">
      <td className="p-4 mono text-xs text-zinc-600">
        {String(index).padStart(2, '0')}
      </td>
      <td
        aria-label={zh ? '仓库' : 'Repository'}
        className="min-w-[320px] py-4"
      >
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[.08] bg-zinc-800 mono text-xs font-bold">
            {repo.owner.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                className="font-medium hover:text-cyan-300"
                href={`/repo/${repo.owner}/${repo.name}${zh ? '' : '?lang=en'}`}
              >
                {repo.full_name}
              </Link>
              <a
                aria-label={`${zh ? '在 GitHub 打开' : 'Open on GitHub'} ${repo.full_name}`}
                href={repo.github_url}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowUpRight className="size-3 text-zinc-600" />
              </a>
            </div>
            <p className="mt-0.5 max-w-[420px] truncate text-xs text-zinc-500">
              {(zh && repo.description_zh) ||
                repo.description ||
                (zh ? 'GitHub 暂无项目简介' : 'No GitHub description')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {repo.signals.map((signal) => (
                <Badge
                  className={`h-5 rounded-[4px] px-1.5 mono text-[9px] ${signalStyles[signal]}`}
                  key={signal}
                >
                  {zh ? signalZh[signal] : signal}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </td>
      <td>
        <Score value={repo.opportunity_score} />
      </td>
      <td>
        <div className="mono text-sm text-cyan-300">
          {repo.velocity === null ? (
            <span className="text-[10px] text-zinc-600">采集中</span>
          ) : (
            <>
              {repo.velocity >= 0 ? '+' : ''}
              {repo.velocity.toFixed(1)}
              <span className="text-[10px] text-zinc-600">
                /h · {repo.velocity_source}
              </span>
            </>
          )}
        </div>
        <div className="mt-1">
          <Growth value={repo.stars_24h} suffix="24h" />
        </div>
        <div className="mt-0.5">
          <RelativeGrowth value={repo.relative_growth_24h} zh={zh} />
        </div>
      </td>
      <td className="hidden xl:table-cell">
        <Spark data={repo.spark} />
      </td>
      <td>
        <div className="flex items-center gap-1.5 mono text-sm">
          <Star className="size-3 text-zinc-600" />
          {repo.stars.toLocaleString()}
        </div>
      </td>
      <td className="hidden 2xl:table-cell">
        <div>
          <Growth value={repo.stars_7d} suffix="7d" />
        </div>
        <div>
          <Growth value={repo.stars_30d} suffix="30d" />
        </div>
      </td>
      <td className="hidden 2xl:table-cell">
        <div className="flex items-center gap-1.5 mono text-xs text-zinc-400">
          <GitFork className="size-3" />
          {repo.forks}
        </div>
        <div className="mt-1 flex items-center gap-1.5 mono text-[10px] text-zinc-600">
          <CircleDot className="size-3" />
          {repo.open_issues}
        </div>
      </td>
      <td className="hidden xl:table-cell">
        <div className="text-xs text-zinc-400">
          {repo.primary_language ?? '—'}
        </div>
        <div className="mt-1 mono text-[10px] text-zinc-600">
          {repo.repository_age_days} {zh ? '天' : 'days'}
        </div>
      </td>
    </tr>
  );
}

export default function Home() {
  const [zh, setZh] = useState(true);
  const [response, setResponse] = useState<RepositoryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('Opportunity Score');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetch('/api/repositories', { cache: 'no-store' });
      const body = (await result.json()) as RepositoryApiResponse & {
        error?: string;
      };
      if (!result.ok) throw new Error(body.error || 'API error');
      setResponse(body);
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
    const lowered = query.toLowerCase();
    const values = [...(response?.data ?? [])].filter((repo) => {
      const haystack =
        `${repo.full_name} ${repo.description ?? ''} ${repo.description_zh ?? ''} ${repo.topics.join(' ')} ${repo.primary_language ?? ''}`.toLowerCase();
      return (
        haystack.includes(lowered) &&
        (category === 'All' || repo.category === category)
      );
    });
    const nullable = (value: number | null) =>
      value ?? Number.NEGATIVE_INFINITY;
    return values.sort((a, b) =>
      sort === '24h Star Growth'
        ? nullable(b.stars_24h) - nullable(a.stars_24h)
        : sort === '7d Star Growth'
          ? nullable(b.stars_7d) - nullable(a.stars_7d)
          : sort === 'Total Stars'
            ? b.stars - a.stars
            : sort === 'Repository Age'
              ? a.repository_age_days - b.repository_age_days
              : b.opportunity_score - a.opportunity_score,
    );
  }, [response, query, category, sort]);
  const breakoutCount =
    response?.data.filter((repo) => repo.signals.includes('BREAKOUT')).length ??
    0;
  const velocities = (
    response?.data
      .map((repo) => repo.velocity)
      .filter((v): v is number => v !== null) ?? []
  ).sort((a, b) => a - b);
  const medianVelocity = velocities.length
    ? velocities[Math.floor(velocities.length / 2)]
    : null;

  return (
    <div className="min-h-screen">
      <Sidebar response={response} zh={zh} />
      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-white/[.07] bg-[#0b0d12]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-zinc-600" />
            <Input
              className="h-9 border-white/[.08] bg-white/[.035] pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                zh
                  ? '搜索仓库、主题或作者…'
                  : 'Search repositories, topics, owners…'
              }
              value={query}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-md border border-white/10 px-2.5 py-1.5 mono text-[10px] text-zinc-400"
              onClick={() => setZh((value) => !value)}
            >
              {zh ? 'EN' : '中文'}
            </button>
            <Button
              aria-label={zh ? '刷新数据' : 'Refresh data'}
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
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="mb-2 mono text-[10px] uppercase tracking-[.2em] text-cyan-400">
                —{' '}
                {zh
                  ? '真实 GitHub 数据 / 动态排序'
                  : 'REAL GITHUB DATA / LIVE RANKING'}
              </div>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {zh
                  ? '正在起飞的 GitHub 项目'
                  : 'GitHub projects taking off now'}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                {zh
                  ? `从 ${response?.meta.repository_count?.toLocaleString() ?? '—'} 个真实仓库中识别增长异常。`
                  : `Traction anomalies across ${response?.meta.repository_count?.toLocaleString() ?? '—'} real repositories.`}
              </p>
            </div>
            <div className="mono text-[10px] text-zinc-600">
              {zh ? '数据更新时间：' : 'Data fetched: '}
              {relativeTime(response?.meta.updated_at ?? null, zh)}
            </div>
          </div>
          <section className="mb-5 grid gap-3 md:grid-cols-3">
            {(
              [
                [
                  Flame,
                  String(breakoutCount),
                  zh ? '符合真实爆发条件' : 'Verified breakouts',
                ],
                [
                  Gauge,
                  medianVelocity === null
                    ? '采集中'
                    : `${medianVelocity.toFixed(1)} Star/h`,
                  zh ? '可用快照速度中位数' : 'Median observed velocity',
                ],
                [
                  Activity,
                  response?.meta.data_status ?? 'WAITING',
                  zh ? '快照新鲜度' : 'Snapshot freshness',
                ],
              ] as Array<[LucideIcon, ReactNode, string]>
            ).map(([Icon, value, label]) => (
              <div className="signal-card" key={String(label)}>
                <div className="stat-icon bg-white/[.03] text-cyan-300">
                  <Icon className="size-4" />
                </div>
                <div className="mt-5 mono text-2xl font-semibold">{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </section>
          <section className="panel overflow-hidden">
            <div className="border-b border-white/[.07] p-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2">
                  <Binoculars className="size-4 text-cyan-300" />
                  <h2 className="text-sm font-medium">
                    {zh ? '机会榜单' : 'Opportunity feed'}
                  </h2>
                  <Badge className="bg-white/[.05] mono text-[10px] text-zinc-500">
                    {rows.length}
                  </Badge>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  {zh ? '排序' : 'Sort'}
                  <select
                    className="h-9 rounded-md border border-white/[.07] bg-[#11141b] px-3 text-zinc-200"
                    onChange={(event) => setSort(event.target.value)}
                    value={sort}
                  >
                    {sortOptions.map((option) => (
                      <option key={option}>
                        {zh ? sortZh[option] : option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex gap-1.5 overflow-x-auto">
                {categories.map((item) => (
                  <button
                    className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs ${item === category ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[.06] text-zinc-500'}`}
                    key={item}
                    onClick={() => setCategory(item)}
                  >
                    {zh ? categoryZh[item] : item}
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <div className="py-20 text-center">
                <p className="text-sm text-rose-300">{error}</p>
                <Button
                  className="mt-4"
                  onClick={() => void load()}
                  variant="outline"
                >
                  {zh ? '重试' : 'Retry'}
                </Button>
              </div>
            ) : loading && !response ? (
              <div className="py-20 text-center text-sm text-zinc-500">
                <RefreshCw className="mx-auto mb-3 animate-spin" />
                {zh
                  ? '正在读取 Supabase 真实数据…'
                  : 'Loading real Supabase data…'}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-20 text-center text-sm text-zinc-500">
                <Search className="mx-auto mb-3" />
                {response?.data.length
                  ? zh
                    ? '没有符合当前筛选条件的仓库'
                    : 'No matching repositories'
                  : zh
                    ? '数据库还没有仓库，请前往数据采集页运行首次发现。'
                    : 'No repositories yet. Run discovery from Data Status.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[.07] bg-black/10 text-xs text-zinc-500">
                      <th className="p-4">#</th>
                      <th>{zh ? '仓库 / 中文简介' : 'Repository'}</th>
                      <th>{zh ? '机会评分' : 'Opportunity'}</th>
                      <th>{zh ? 'Star 速度' : 'Velocity'}</th>
                      <th className="hidden xl:table-cell">
                        {zh ? '真实趋势' : 'Observed trend'}
                      </th>
                      <th>Star</th>
                      <th className="hidden 2xl:table-cell">
                        {zh ? '增长' : 'Growth'}
                      </th>
                      <th className="hidden 2xl:table-cell">
                        {zh ? '社区' : 'Community'}
                      </th>
                      <th className="hidden xl:table-cell">
                        {zh ? '语言 / 年龄' : 'Language / age'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((repo, index) => (
                      <RepoRow
                        index={index + 1}
                        key={repo.id}
                        repo={repo}
                        zh={zh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-between border-t border-white/[.07] px-5 py-3 text-[11px] text-zinc-600">
              <span>
                {zh
                  ? '增长仅来自已持久化快照'
                  : 'Growth uses persisted snapshots only'}
              </span>
              <span className="mono">
                {relativeTime(response?.meta.last_snapshot_at ?? null, zh)}
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
