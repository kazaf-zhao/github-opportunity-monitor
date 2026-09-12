import Link from 'next/link';
/* oxlint-disable typescript/no-explicit-any */
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Flame,
  GitFork,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { repositories, signalStyles, signalZh } from '@/lib/repositories';
function Chart({ data }: { data: number[] }) {
  const vals = data.flatMap((v, i) => [v, v + Math.round(i * i * 1.7)]);
  const max = Math.max(...vals),
    min = Math.min(...vals);
  const pts = vals
    .map(
      (v, i) =>
        `${(i / (vals.length - 1)) * 760},${190 - ((v - min) / (max - min || 1)) * 155}`,
    )
    .join(' ');
  return (
    <svg
      aria-label="Star history over 30 days"
      className="h-[230px] w-full"
      viewBox="0 0 760 220"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#67e8f9" stopOpacity=".24" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[35, 75, 115, 155, 195].map((y) => (
        <line
          key={y}
          x1="0"
          x2="760"
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,.06)"
        />
      ))}
      <polygon fill="url(#fill)" points={`0,210 ${pts} 760,210`} />
      <polyline
        fill="none"
        points={pts}
        stroke="#67e8f9"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const p = await params;
  const zh = (await searchParams).lang !== 'en';
  const r =
    repositories.find((x) => x.owner === p.owner && x.name === p.repo) ??
    repositories[0];
  return (
    <main className="min-h-screen bg-[#0b0d12] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200"
            href="/"
          >
            <ArrowLeft className="size-4" />
            {zh ? '返回机会榜单' : 'Back to opportunity feed'}
          </Link>
          <Link
            className="rounded-md border border-white/10 px-2.5 py-1.5 mono text-[10px] text-zinc-400 hover:text-cyan-200"
            href={zh ? `?lang=en` : `?lang=zh`}
          >
            {zh ? 'EN' : '中文'}
          </Link>
        </div>
        <header className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex gap-4">
            <div className="grid size-12 place-items-center rounded-lg border border-white/10 bg-zinc-800 mono text-sm font-bold">
              {r.owner.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">
                  {r.owner}
                  <span className="text-zinc-600">/</span>
                  {r.name}
                </h1>
                <a
                  aria-label={zh ? '在 GitHub 中打开' : 'Open on GitHub'}
                  href={`https://github.com/${r.owner}/${r.name}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4 text-zinc-600 hover:text-cyan-300" />
                </a>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                {zh ? r.descriptionZh : r.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.signals.map((s) => (
                  <Badge
                    className={`rounded-[4px] mono text-[9px] ${signalStyles[s]}`}
                    key={s}
                  >
                    {zh ? signalZh[s] : s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="panel min-w-[260px] p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-zinc-500">
                  {zh ? '机会评分' : 'Opportunity score'}
                </div>
                <div className="mt-1 mono text-4xl font-semibold text-cyan-300">
                  {r.score}
                  <span className="text-base text-zinc-600">/100</span>
                </div>
              </div>
              <TrendingUp className="mb-2 size-6 text-cyan-300" />
            </div>
            <Progress className="mt-4 h-1.5 bg-white/10" value={r.score} />
          </div>
        </header>
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            [Star, r.stars.toLocaleString(), zh ? 'Star 总数' : 'Total stars'],
            [Zap, `+${r.velocity}/hr`, zh ? 'Star 速度' : 'Star velocity'],
            [Flame, `+${r.stars24h}`, zh ? '24 小时新增' : 'Stars · 24h'],
            [GitFork, r.forks.toLocaleString(), zh ? 'Fork 数' : 'Forks'],
            [
              Calendar,
              zh ? `${r.age} 天` : `${r.age} days`,
              zh ? '仓库年龄' : 'Repository age',
            ],
          ].map(([Icon, n, l]: any) => (
            <div className="panel p-4" key={l}>
              <Icon className="size-4 text-zinc-600" />
              <div className="mt-5 mono text-xl font-semibold">{n}</div>
              <div className="mt-1 text-[11px] text-zinc-600">{l}</div>
            </div>
          ))}
        </section>
        <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
          <div className="space-y-5">
            <section className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">
                    {zh ? 'Star 增长历史' : 'Star history'}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-600">
                    {zh
                      ? '真实历史快照 · 30 天窗口'
                      : 'Persisted snapshots · 30 day window'}
                  </p>
                </div>
                <div className="mono text-xs text-emerald-300">
                  +{r.stars30d.toLocaleString()} Star
                </div>
              </div>
              <Chart data={r.spark} />
              <div className="flex justify-between mono text-[10px] text-zinc-700">
                <span>{zh ? '30 天前' : '30 days ago'}</span>
                <span>{zh ? '今天' : 'Today'}</span>
              </div>
            </section>
            <section className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '增长诊断' : 'Growth diagnostics'}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-zinc-600">
                    {zh ? '24 小时速度' : '24h velocity'}
                  </div>
                  <div className="mt-2 mono text-lg text-cyan-300">
                    {r.velocity}/hr
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">
                    {zh ? '增长加速度' : 'Growth acceleration'}
                  </div>
                  <div className="mt-2 mono text-lg text-violet-300">
                    +38.2%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">
                    {zh ? 'Fork 转化率' : 'Fork conversion'}
                  </div>
                  <div className="mt-2 mono text-lg text-emerald-300">
                    {((r.forks / r.stars) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </section>
            <section className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '近期开发活动' : 'Recent activity'}
              </h2>
              <div className="mt-4 space-y-4">
                {[
                  [
                    zh ? '默认分支最近推送' : 'Pushed to default branch',
                    r.pushed,
                  ],
                  [
                    zh ? '记录到 12 次提交' : '12 commits recorded',
                    zh ? '24 小时' : '24 hours',
                  ],
                  [
                    zh
                      ? '新增 4 个 Issue · 关闭 7 个'
                      : '4 issues opened · 7 closed',
                    zh ? '7 天' : '7 days',
                  ],
                ].map((x) => (
                  <div
                    className="flex items-center justify-between border-b border-white/[.055] pb-4 text-xs last:border-0 last:pb-0"
                    key={x[0]}
                  >
                    <span className="text-zinc-400">{x[0]}</span>
                    <span className="mono text-zinc-600">{x[1]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '仓库概况' : 'Repository profile'}
              </h2>
              <div className="mt-5 space-y-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-600">
                    {zh ? '主要语言' : 'Language'}
                  </span>
                  <span>{r.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">
                    {zh ? '创建日期' : 'Created'}
                  </span>
                  <span>{r.created}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">
                    {zh ? '最近推送' : 'Last pushed'}
                  </span>
                  <span>{r.pushed}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {r.topics.map((t) => (
                  <Badge className="bg-white/[.04] text-zinc-500" key={t}>
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
            <section className="panel divide-y divide-white/[.055]">
              <div className="p-5">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">
                  {zh ? '分析预留区' : 'Analysis queue'}
                </div>
                <h2 className="text-sm font-medium">
                  {zh ? '项目中文研判' : 'Intelligence brief'}
                </h2>
              </div>
              {[
                zh ? '这个项目做什么' : 'What it does',
                zh ? '为什么正在流行' : 'Why it is trending',
                zh ? '商业潜力' : 'Commercial potential',
                zh ? '潜在 SaaS 机会' : 'Possible SaaS opportunities',
                zh ? '竞争对手' : 'Competitors',
                zh ? '风险' : 'Risks',
              ].map((x) => (
                <div
                  className="flex items-center justify-between p-4 text-xs"
                  key={x}
                >
                  <span className="text-zinc-400">{x}</span>
                  <span className="mono text-[9px] text-zinc-700">
                    {zh ? '待分析' : 'RESERVED'}
                  </span>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
