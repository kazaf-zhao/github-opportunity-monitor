'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { repositories } from '@/lib/repositories';
const defaults = [
  'AI Agent',
  'MCP',
  'Browser Agent',
  'Trading Agent',
  'Prediction Market',
  'Polymarket',
  'Crypto AI',
  'Stablecoin',
  'RAG',
  'Voice AI',
  'Computer Use',
  'OpenAI',
  'Claude',
  'Local AI',
];
declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: unknown,
        options?: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}
export default function Watchlist() {
  const [zh, setZh] = useState(true);
  const [items, setItems] = useState(() =>
    defaults.map((keyword, i) => ({ keyword, enabled: i < 11 })),
  );
  const [draft, setDraft] = useState('');
  const add = useCallback(
    (value = draft) => {
      const keyword = value.trim();
      if (
        !keyword ||
        items.some((x) => x.keyword.toLowerCase() === keyword.toLowerCase())
      )
        return false;
      setItems((x) => [{ keyword, enabled: true }, ...x]);
      setDraft('');
      return true;
    },
    [draft, items],
  );
  useEffect(() => {
    const ctx = document.modelContext;
    if (!ctx?.registerTool) return;
    const c = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: 'create_keyword_monitor',
          title: 'Create keyword monitor',
          description:
            'Add and enable a keyword in the visible repository watchlist.',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: { type: 'string', minLength: 1, maxLength: 80 },
            },
            required: ['keyword'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const keyword =
              typeof input === 'object' && input && 'keyword' in input
                ? String((input as { keyword: unknown }).keyword)
                : '';
            if (!keyword.trim()) throw new Error('keyword is required');
            const created = add(keyword);
            if (!created) throw new Error('keyword already exists');
            return { keyword: keyword.trim(), enabled: true };
          },
        },
        { signal: c.signal },
      ),
    ).catch(() => {});
    return () => c.abort();
  }, [add]);
  const matches = useMemo(
    () =>
      items.map((x) => ({
        ...x,
        count: repositories.filter((r) =>
          JSON.stringify(r)
            .toLowerCase()
            .includes(x.keyword.toLowerCase().replace(' agent', '')),
        ).length,
      })),
    [items],
  );
  return (
    <main className="min-h-screen bg-[#0b0d12] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              aria-label={zh ? '返回发现页' : 'Back to discover'}
              className="grid size-9 place-items-center rounded-md border border-white/10 text-zinc-500 hover:text-white"
              href="/"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="mono text-[10px] uppercase tracking-[.2em] text-cyan-400">
                {zh ? '信号配置' : 'Signal configuration'}
              </div>
              <h1 className="mt-1 text-2xl font-semibold">
                {zh ? '关键词监控' : 'Keyword watchlist'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <button
              className="rounded-md border border-white/10 px-2.5 py-1.5 mono text-[10px] hover:text-cyan-200"
              onClick={() => setZh((value) => !value)}
            >
              {zh ? 'EN' : '中文'}
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <TrendingUp className="size-4 text-cyan-300" />
              {items.filter((x) => x.enabled).length}{' '}
              {zh ? '个启用中的监控' : 'active monitors'}
            </div>
          </div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
          <section className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-zinc-600" />
                <Input
                  className="h-9 border-white/[.08] bg-white/[.03] pl-9"
                  placeholder={zh ? '筛选关键词…' : 'Filter keywords…'}
                />
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <Input
                  aria-label={zh ? '新关键词' : 'New keyword'}
                  className="h-9 border-white/[.08] bg-white/[.03]"
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={zh ? '添加关键词' : 'Add a keyword'}
                  value={draft}
                />
                <Button className="h-9 bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  <Plus />
                  {zh ? '添加' : 'Add'}
                </Button>
              </form>
            </div>
            <div className="divide-y divide-white/[.055]">
              {matches.map((x, i) => (
                <div
                  className="flex items-center gap-4 px-4 py-4"
                  key={x.keyword}
                >
                  <Switch
                    aria-label={`${zh ? (x.enabled ? '停用' : '启用') : x.enabled ? 'Disable' : 'Enable'} ${x.keyword}`}
                    checked={x.enabled}
                    onCheckedChange={(enabled) =>
                      setItems((a) =>
                        a.map((v, j) => (j === i ? { ...v, enabled } : v)),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        x.enabled
                          ? 'font-medium text-zinc-200'
                          : 'font-medium text-zinc-600'
                      }
                    >
                      {x.keyword}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {zh
                        ? '匹配仓库名、项目简介、README 摘要和主题标签'
                        : 'Matches name, description, README summary and topics'}
                    </div>
                  </div>
                  <Badge className="bg-white/[.04] mono text-[10px] text-zinc-500">
                    {x.count} {zh ? '个仓库' : 'REPOS'}
                  </Badge>
                  <button
                    aria-label={`${zh ? '删除' : 'Remove'} ${x.keyword}`}
                    className="p-2 text-zinc-700 hover:text-rose-400"
                    onClick={() => setItems((a) => a.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <aside className="space-y-4">
            <div className="panel p-5">
              <h2 className="text-sm font-medium">
                {zh ? '监控状态' : 'Monitor health'}
              </h2>
              <div className="mt-5 space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">
                    {zh ? '启用' : 'Active'}
                  </span>
                  <span className="mono text-emerald-300">
                    {items.filter((x) => x.enabled).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">
                    {zh ? '暂停' : 'Paused'}
                  </span>
                  <span className="mono text-zinc-300">
                    {items.filter((x) => !x.enabled).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">
                    {zh ? '今日匹配' : 'Matches today'}
                  </span>
                  <span className="mono text-cyan-300">
                    {matches.reduce((a, b) => a + b.count, 0)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[.045] p-5">
              <Eye className="size-4 text-cyan-300" />
              <h2 className="mt-4 text-sm font-medium">
                {zh ? '匹配方式' : 'How matching works'}
              </h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {zh
                  ? '启用的关键词会加入 GitHub 发现查询，并与仓库元数据进行匹配。发现新项目后，会自动进入机会评分与排序流程。'
                  : 'Enabled keywords are included in discovery queries and checked against repository metadata. New matches enter the ranking pipeline automatically.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
