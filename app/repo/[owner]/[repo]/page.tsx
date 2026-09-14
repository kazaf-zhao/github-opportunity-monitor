import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  Calendar,
  ExternalLink,
  GitFork,
  Star,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getRepositoryOpportunities } from '@/lib/repository-data';
import { signalStyles, signalZh } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

function Chart({ data }: { data: number[] }) {
  if (data.length < 2)
    return (
      <div className="grid h-[230px] place-items-center text-sm text-zinc-600">
        历史数据采集中
      </div>
    );
  const max = Math.max(...data),
    min = Math.min(...data);
  const points = data
    .map(
      (value, index) =>
        `${(index / (data.length - 1)) * 760},${190 - ((value - min) / (max - min || 1)) * 155}`,
    )
    .join(' ');
  return (
    <svg
      aria-label="真实 Star 历史"
      className="h-[230px] w-full"
      preserveAspectRatio="none"
      viewBox="0 0 760 220"
    >
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#67e8f9" stopOpacity=".24" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#fill)" points={`0,210 ${points} 760,210`} />
      <polyline
        fill="none"
        points={points}
        stroke="#67e8f9"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const metric = (value: number | null, suffix = '') =>
  value === null
    ? '采集中'
    : `${value >= 0 ? '+' : ''}${value.toLocaleString()}${suffix}`;

export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const route = await params;
  const zh = (await searchParams).lang !== 'en';
  let repository = null;
  try {
    const response = await getRepositoryOpportunities({
      owner: route.owner,
      repo: route.repo,
      limit: 1,
    });
    repository = response.data[0] ?? null;
  } catch {}
  if (!repository)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0d12]">
        <div className="text-center">
          <p className="text-zinc-400">
            {zh ? '没有找到该真实仓库记录' : 'Repository is not monitored'}
          </p>
          <Link className="mt-4 inline-block text-sm text-cyan-300" href="/">
            {zh ? '返回发现页' : 'Back to Discover'}
          </Link>
        </div>
      </main>
    );
  const r = repository;
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
            className="rounded-md border border-white/10 px-2.5 py-1.5 mono text-[10px] text-zinc-400"
            href={zh ? '?lang=en' : '?lang=zh'}
          >
            {zh ? 'EN' : '中文'}
          </Link>
        </div>
        <header className="mb-7 flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{r.full_name}</h1>
              <a href={r.github_url} rel="noreferrer" target="_blank">
                <ExternalLink className="size-4 text-zinc-600" />
              </a>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              {(zh && r.description_zh) ||
                r.description ||
                (zh ? 'GitHub 暂无项目简介' : 'No GitHub description')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.signals.map((signal) => (
                <Badge
                  className={`rounded-[4px] mono text-[9px] ${signalStyles[signal]}`}
                  key={signal}
                >
                  {zh ? signalZh[signal] : signal}
                </Badge>
              ))}
            </div>
          </div>
          <div className="panel min-w-[300px] p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500">
                  GitHub Momentum
                </div>
                <div className="mt-1 mono text-4xl font-semibold text-cyan-300">
                  {r.opportunity_score}
                  <span className="text-base text-zinc-600">/100</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Commercial</div>
                <div className="mt-1 mono text-4xl font-semibold text-fuchsia-300">
                  {r.commercial?.commercial_score ?? '—'}
                  <span className="text-base text-zinc-600">/100</span>
                </div>
              </div>
            </div>
            <Progress
              className="mt-4 h-1.5 bg-white/10"
              value={r.opportunity_score}
            />
          </div>
        </header>
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              [
                Star,
                r.stars.toLocaleString(),
                zh ? 'Star 总数' : 'Total stars',
              ],
              [
                Zap,
                r.velocity === null ? '采集中' : `${r.velocity.toFixed(1)}/h`,
                zh
                  ? `Star 速度 · ${r.velocity_source ?? ''}`
                  : `Velocity · ${r.velocity_source ?? ''}`,
              ],
              [
                TrendingUp,
                metric(r.stars_24h),
                zh ? '24 小时新增' : 'Stars · 24h',
              ],
              [GitFork, r.forks.toLocaleString(), zh ? 'Fork 数' : 'Forks'],
              [
                Calendar,
                `${r.repository_age_days} ${zh ? '天' : 'days'}`,
                zh ? '仓库年龄' : 'Repository age',
              ],
            ] as Array<[LucideIcon, ReactNode, string]>
          ).map(([Icon, value, label]) => (
            <div className="panel p-4" key={String(label)}>
              <Icon className="size-4 text-zinc-600" />
              <div className="mt-5 mono text-xl font-semibold">{value}</div>
              <div className="mt-1 text-[11px] text-zinc-600">{label}</div>
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
                      ? '仅展示 Supabase 持久化快照'
                      : 'Persisted Supabase snapshots only'}
                  </p>
                </div>
                <div className="mono text-xs text-emerald-300">
                  {metric(r.stars_30d, ' Star')}
                </div>
              </div>
              <Chart data={r.spark} />
            </section>
            <section className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '增长诊断' : 'Growth diagnostics'}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-zinc-600">1h / 24h</div>
                  <div className="mt-2 mono text-lg text-cyan-300">
                    {metric(r.stars_1h)} / {metric(r.stars_24h)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">
                    {zh ? '24h 相对增长' : 'Relative growth · 24h'}
                  </div>
                  <div className="mt-2 mono text-lg text-cyan-300">
                    {r.relative_growth_24h === null
                      ? '采集中'
                      : `${r.relative_growth_24h >= 0 ? '+' : ''}${(r.relative_growth_24h * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">
                    {zh ? '增长加速度' : 'Acceleration'}
                  </div>
                  <div className="mt-2 mono text-lg text-violet-300">
                    {r.acceleration === null
                      ? '采集中'
                      : `${r.acceleration.toFixed(2)}×`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">Fork / Star</div>
                  <div className="mt-2 mono text-lg text-emerald-300">
                    {r.stars
                      ? `${((r.forks / r.stars) * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            {r.commercial && (
              <section className="panel border-emerald-300/15 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-emerald-200">
                    Money Radar
                  </h2>
                  <BadgeDollarSign className="size-5 text-emerald-300" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Money', r.commercial.money_score],
                    ['Demand', r.commercial.demand_score],
                    ['Indie', r.commercial.indie_score],
                    ['Gap', r.commercial.competition_gap],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-md border border-white/[.06] p-2"
                      key={String(label)}
                    >
                      <div className="mono text-xl text-emerald-300">
                        {value}
                      </div>
                      <div className="mono text-[9px] text-zinc-600">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.commercial.opportunity_types.map((type) => (
                    <Badge
                      className="border-fuchsia-300/20 bg-fuchsia-300/[.06] text-[9px] text-fuchsia-200"
                      key={type}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
            <section className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '仓库概况' : 'Repository profile'}
              </h2>
              <div className="mt-5 space-y-4 text-xs">
                {[
                  ['Language', r.primary_language ?? '—'],
                  ['Open issues', r.open_issues],
                  ['Created', new Date(r.created_at).toLocaleDateString()],
                  [
                    'Last pushed',
                    r.pushed_at ? new Date(r.pushed_at).toLocaleString() : '—',
                  ],
                ].map(([label, value]) => (
                  <div
                    className="flex justify-between gap-4"
                    key={String(label)}
                  >
                    <span className="text-zinc-600">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </div>
            </section>
            {!r.commercial && (
              <section className="panel p-5 text-sm text-zinc-500">
                {zh
                  ? '商业机会分析正在采集。系统会读取真实 README 与最近 30 天 Issue 标题。'
                  : 'Commercial analysis is collecting real README and recent Issue-title evidence.'}
              </section>
            )}
          </aside>
        </div>
        {r.commercial && (
          <section className="panel mt-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">
                  {zh ? '商业机会诊断' : 'Commercial opportunity diagnosis'}
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  {zh
                    ? '基于 README 和最近 30 天非 PR Issue 标题的规则分析，不是收入预测。'
                    : 'Rule-based analysis of README and 30-day non-PR Issue titles; not a revenue forecast.'}
                </p>
              </div>
              <div className="mono text-xs text-zinc-500">
                {r.commercial.difficulty} · MVP {r.commercial.estimated_mvp}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ['Why Now', r.commercial.why_now],
                ['User Pain', r.commercial.user_pain],
                ['What To Build', r.commercial.what_to_build],
                ['Who Pays', r.commercial.who_pays],
                ['Monetization', r.commercial.monetization],
              ].map(([label, value]) => (
                <div
                  className="rounded-md border border-white/[.06] bg-black/10 p-4"
                  key={label}
                >
                  <div className="mono text-[10px] uppercase text-fuchsia-300">
                    {label}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-400">{value}</p>
                </div>
              ))}
            </div>
            <h3 className="mt-7 text-sm font-medium">
              {zh ? '可以怎么赚钱？' : 'Monetization ideas'}
            </h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {r.commercial.monetization_ideas.map((idea, index) => (
                <div
                  className="rounded-lg border border-emerald-300/10 bg-emerald-300/[.025] p-4"
                  key={`${idea.type}-${index}`}
                >
                  <div className="mono text-[10px] text-emerald-300">
                    {String(index + 1).padStart(2, '0')} / {idea.type}
                  </div>
                  <div className="mt-3 text-sm text-zinc-200">
                    {idea.product}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    <span className="text-zinc-300">客户：</span>
                    {idea.customer}
                    <br />
                    <span className="text-zinc-300">依据：</span>
                    {idea.reason}
                    <br />
                    <span className="text-zinc-300">收费：</span>
                    {idea.pricing}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-7 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[.07] text-zinc-600">
                  <tr>
                    <th className="pb-3">Issues analyzed</th>
                    <th className="pb-3">Feature</th>
                    <th className="pb-3">Deployment</th>
                    <th className="pb-3">Integration</th>
                    <th className="pb-3">Hosted</th>
                    <th className="pb-3">API</th>
                    <th className="pb-3">UI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="mono text-zinc-300">
                    <td className="pt-3">{r.commercial.evidence.issues_analyzed}</td>
                    <td className="pt-3">{r.commercial.evidence.feature_requests}</td>
                    <td className="pt-3">{r.commercial.evidence.deployment_problems}</td>
                    <td className="pt-3">{r.commercial.evidence.integration_requests}</td>
                    <td className="pt-3">{r.commercial.evidence.hosted_requests}</td>
                    <td className="pt-3">{r.commercial.evidence.api_requests}</td>
                    <td className="pt-3">{r.commercial.evidence.ui_requests}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
