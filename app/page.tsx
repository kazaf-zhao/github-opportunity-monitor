'use client';
/* oxlint-disable typescript/no-explicit-any */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Binoculars,
  BookMarked,
  ChevronDown,
  CircleDot,
  Command,
  Database,
  Filter,
  Flame,
  Gauge,
  GitFork,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { repositories, signalStyles, type Repo } from '@/lib/repositories';
const categories = [
  'All',
  'AI',
  'Agents',
  'MCP',
  'Developer Tools',
  'Crypto',
  'Trading',
  'Data',
  'Infrastructure',
  'Productivity',
];
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
        <TrendingUp className="size-4 text-cyan-300" />
      </div>
      <div>
        <div className="text-[13px] font-semibold tracking-wide">
          OPPORTUNITY
        </div>
        <div className="mono text-[9px] tracking-[.22em] text-zinc-500">
          GITHUB MONITOR
        </div>
      </div>
    </div>
  );
}
function Sidebar({ mobile = false }: { mobile?: boolean }) {
  return (
    <aside
      className={
        mobile
          ? 'h-full bg-[#080a0e]'
          : 'fixed inset-y-0 left-0 z-30 hidden w-[228px] border-r border-white/[.07] bg-[#080a0e] lg:block'
      }
    >
      <div className="flex h-[68px] items-center border-b border-white/[.07] px-5">
        <Logo />
      </div>
      <nav className="space-y-1 px-3 py-5 text-sm">
        <div className="mb-2 px-3 mono text-[10px] uppercase tracking-[.18em] text-zinc-600">
          Workspace
        </div>
        <Link
          className="flex items-center gap-3 rounded-md border border-cyan-400/10 bg-cyan-400/[.08] px-3 py-2.5 font-medium text-cyan-200"
          href="/"
        >
          <LayoutDashboard className="size-4" />
          Discover
          <span className="ml-auto rounded bg-cyan-300/15 px-1.5 mono text-[10px]">
            42
          </span>
        </Link>
        <Link className="nav-item" href="/watchlist">
          <BookMarked className="size-4" />
          Watchlist
        </Link>
        <button className="nav-item w-full">
          <Zap className="size-4" />
          Signals
        </button>
        <button className="nav-item w-full">
          <History className="size-4" />
          Snapshot history
        </button>
        <div className="mb-2 mt-7 px-3 mono text-[10px] uppercase tracking-[.18em] text-zinc-600">
          System
        </div>
        <button className="nav-item w-full">
          <Database className="size-4" />
          Collectors
        </button>
        <button className="nav-item w-full">
          <Settings className="size-4" />
          Settings
        </button>
      </nav>
      <div className="absolute inset-x-3 bottom-4 rounded-lg border border-white/[.07] bg-white/[.025] p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
          <span className="size-2 rounded-full bg-emerald-400" />
          All systems operational
        </div>
        <div className="mono text-[10px] leading-5 text-zinc-600">
          Last snapshot 4m ago
          <br />
          1,284 repos monitored
        </div>
      </div>
    </aside>
  );
}
function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data),
    min = Math.min(...data);
  const pts = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 104},${28 - ((v - min) / (max - min || 1)) * 24}`,
    )
    .join(' ');
  return (
    <svg
      aria-label="Seven day trend"
      height="30"
      viewBox="0 0 104 30"
      width="104"
    >
      <polyline
        fill="none"
        points={pts}
        stroke="#67e8f9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
function Score({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <strong
        className={`mono text-2xl ${n >= 88 ? 'text-cyan-300' : n >= 75 ? 'text-emerald-300' : 'text-amber-300'}`}
      >
        {n}
      </strong>
      <Progress className="hidden h-1 w-10 bg-white/10 xl:block" value={n} />
    </div>
  );
}
function Row({ r, i }: { r: Repo; i: number }) {
  return (
    <TableRow className="group border-white/[.055] hover:bg-white/[.025]">
      <TableCell className="pl-4 mono text-xs text-zinc-600">
        {String(i).padStart(2, '0')}
      </TableCell>
      <TableCell className="min-w-[320px] py-4">
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[.08] bg-zinc-800 mono text-xs font-bold">
            {r.owner.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                className="font-medium hover:text-cyan-300"
                href={`/repo/${r.owner}/${r.name}`}
              >
                {r.owner}
                <span className="text-zinc-600">/</span>
                {r.name}
              </Link>
              <ArrowUpRight className="size-3 text-zinc-600" />
            </div>
            <p className="mt-0.5 max-w-[380px] truncate text-xs text-zinc-500">
              {r.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.signals.map((s) => (
                <Badge
                  className={`h-5 rounded-[4px] px-1.5 mono text-[9px] ${signalStyles[s]}`}
                  key={s}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Score n={r.score} />
      </TableCell>
      <TableCell>
        <div className="mono text-sm text-cyan-300">
          +{r.velocity.toFixed(1)}
          <span className="text-[10px] text-zinc-600">/hr</span>
        </div>
        <div className="mt-1 mono text-[10px] text-emerald-400">
          +{r.stars24h.toLocaleString()} today
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <Spark data={r.spark} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 mono text-sm">
          <Star className="size-3 text-zinc-600" />
          {r.stars.toLocaleString()}
        </div>
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        <div className="mono text-xs text-emerald-300">
          +{r.stars7d.toLocaleString()}{' '}
          <span className="text-zinc-600">7d</span>
        </div>
        <div className="mono text-xs text-zinc-400">
          +{r.stars30d.toLocaleString()}{' '}
          <span className="text-zinc-600">30d</span>
        </div>
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        <div className="flex items-center gap-1.5 mono text-xs text-zinc-400">
          <GitFork className="size-3" />
          {r.forks}
        </div>
        <div className="mt-1 flex items-center gap-1.5 mono text-[10px] text-zinc-600">
          <CircleDot className="size-3" />
          {r.issues} open
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <div className="text-xs text-zinc-400">{r.language}</div>
        <div className="mt-1 mono text-[10px] text-zinc-600">
          {r.age} days old
        </div>
      </TableCell>
    </TableRow>
  );
}
export default function Home() {
  const [cat, setCat] = useState('All'),
    [sort, setSort] = useState('Opportunity Score'),
    [q, setQ] = useState('');
  const rows = useMemo(
    () =>
      repositories
        .filter(
          (r) =>
            (cat === 'All' || r.category === cat) &&
            JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          sort === '24h Star Growth'
            ? b.stars24h - a.stars24h
            : sort === '7d Star Growth'
              ? b.stars7d - a.stars7d
              : sort === 'Total Stars'
                ? b.stars - a.stars
                : sort === 'Repository Age'
                  ? a.age - b.age
                  : b.score - a.score,
        ),
    [cat, sort, q],
  );
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-white/[.07] bg-[#0b0d12]/90 px-4 backdrop-blur-xl sm:px-6">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  aria-label="Open navigation"
                  className="mr-3 lg:hidden"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent
              className="w-[240px] border-white/10 bg-[#080a0e] p-0"
              side="left"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar mobile />
            </SheetContent>
          </Sheet>
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-zinc-600" />
            <Input
              className="h-9 border-white/[.08] bg-white/[.035] pl-9"
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search repositories, topics, owners…"
              value={q}
            />
            <span className="absolute right-2 top-2 hidden items-center gap-1 mono text-[9px] text-zinc-600 sm:flex">
              <Command className="size-3" />K
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="mr-2 hidden mono text-[10px] text-emerald-400 md:block">
              ● LIVE DATA
            </span>
            <Button size="icon" variant="ghost">
              <RefreshCw className="size-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <BellRing className="size-4" />
            </Button>
            <div className="grid size-8 place-items-center rounded-full border border-white/10 bg-zinc-800 mono text-[10px]">
              KZ
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="mb-2 mono text-[10px] uppercase tracking-[.2em] text-cyan-400">
                — Market scan / Live
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Projects taking off{' '}
                <span className="font-normal text-zinc-600">right now</span>
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                Traction anomalies ranked from 1,284 monitored repositories.
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[.07] panel px-1 py-2">
              {[
                ['42', 'Breakouts'],
                ['+18.6%', 'Velocity'],
                ['7', 'New today'],
              ].map((x) => (
                <div className="px-4" key={x[1]}>
                  <div className="mono text-lg font-semibold text-zinc-200">
                    {x[0]}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {x[1]}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <section className="mb-5 grid gap-3 md:grid-cols-3">
            {[
              [
                Flame,
                '42',
                'Repositories in breakout territory',
                'text-cyan-300',
              ],
              [
                Gauge,
                '9.4 stars/hr',
                'Median velocity across top 10',
                'text-violet-300',
              ],
              [
                Activity,
                '98.7%',
                'Snapshot coverage in the last hour',
                'text-emerald-300',
              ],
            ].map(([Icon, n, l, c]: any) => (
              <div className="signal-card" key={l}>
                <div className={`stat-icon bg-white/[.03] ${c}`}>
                  <Icon className="size-4" />
                </div>
                <div className="mt-5 mono text-2xl font-semibold">{n}</div>
                <div className="mt-1 text-xs text-zinc-500">{l}</div>
              </div>
            ))}
          </section>
          <section className="panel overflow-hidden">
            <div className="border-b border-white/[.07] p-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2">
                  <Binoculars className="size-4 text-cyan-300" />
                  <h2 className="text-sm font-medium">Opportunity feed</h2>
                  <Badge className="bg-white/[.05] mono text-[10px] text-zinc-500">
                    {rows.length} MATCHES
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 rounded-md border border-white/[.07] bg-black/10 px-3 text-xs text-zinc-500">
                    <Filter className="size-3" />
                    Sort by
                    <select
                      className="h-9 bg-transparent text-zinc-200 outline-none"
                      onChange={(e) => setSort(e.target.value)}
                      value={sort}
                    >
                      {[
                        'Opportunity Score',
                        '24h Star Growth',
                        '7d Star Growth',
                        'Total Stars',
                        'Repository Age',
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <ChevronDown className="size-3" />
                  </label>
                  <Link href="/watchlist">
                    <Button
                      className="h-9 border-white/[.08] bg-white/[.035] text-xs"
                      variant="outline"
                    >
                      <Plus />
                      Create monitor
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5 overflow-x-auto">
                {categories.map((x) => (
                  <button
                    className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs ${x === cat ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[.06] text-zinc-500'}`}
                    key={x}
                    onClick={() => setCat(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[.07] bg-black/10">
                    <TableHead>#</TableHead>
                    <TableHead>Repository</TableHead>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Star velocity</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      7d trend
                    </TableHead>
                    <TableHead>Stars</TableHead>
                    <TableHead className="hidden 2xl:table-cell">
                      Growth
                    </TableHead>
                    <TableHead className="hidden 2xl:table-cell">
                      Community
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Language / age
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <Row i={i + 1} key={r.name} r={r} />
                  ))}
                </TableBody>
              </Table>
            </div>
            {!rows.length && (
              <div className="py-20 text-center text-sm text-zinc-500">
                <Search className="mx-auto mb-3" />
                No repositories match this view
              </div>
            )}
            <div className="flex justify-between border-t border-white/[.07] px-5 py-3 text-[11px] text-zinc-600">
              <span>Snapshot window: 30 days</span>
              <span className="mono">UPDATED 4 MIN AGO</span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
