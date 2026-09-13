import { discover, snapshot } from '@/lib/collector';
import { checkGitHub } from '@/lib/github';
import { supabaseCount, supabaseRequest } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Run = {
  job: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  discovery_source_counts: Record<string, number>;
  query_tier_counts: Record<string, number>;
};
type RecallStatus = {
  source_counts: Record<string, number>;
  candidate_count: number;
  deduplicated_count: number;
  computed_at: string;
  category_pool_counts: Record<string, number>;
  top50_category_counts: Record<string, number>;
  category_bias: Array<{
    category: string;
    pool_share: number;
    top50_share: number;
    ratio: number;
  }>;
};

export async function GET() {
  let supabase: '正常' | '异常' = '正常';
  let github: '正常' | '异常' = '正常';
  let repositoryCount = 0;
  let snapshotCount = 0;
  let lastSnapshot: string | null = null;
  let runs: Run[] = [];
  let recallStatus: RecallStatus | null = null;
  let githubRate: Awaited<ReturnType<typeof checkGitHub>> | null = null;
  const errors: string[] = [];
  try {
    [repositoryCount, snapshotCount, runs] = await Promise.all([
      supabaseCount('repositories'),
      supabaseCount('repository_snapshots'),
      supabaseRequest<Run[]>(
        'collector_runs?select=job,status,started_at,completed_at,error_message,discovery_source_counts,query_tier_counts&order=started_at.desc&limit=20',
      ),
    ]);
    const latest = await supabaseRequest<Array<{ captured_at: string }>>(
      'repository_snapshots?select=captured_at&order=captured_at.desc&limit=1',
    );
    lastSnapshot = latest[0]?.captured_at ?? null;
    const recallRows = await supabaseRequest<RecallStatus[]>(
      'candidate_recall_status?select=source_counts,candidate_count,deduplicated_count,computed_at,category_pool_counts,top50_category_counts,category_bias&id=eq.true&limit=1',
    );
    recallStatus = recallRows[0] ?? null;
  } catch (error) {
    supabase = '异常';
    errors.push(String(error));
  }
  try {
    githubRate = await checkGitHub();
  } catch (error) {
    github = '异常';
    errors.push(String(error));
  }
  const discoveryRun = runs.find((run) => run.job === 'discover');
  // Only surface an error when the latest run for that collector job failed.
  // A later successful run means the older error has recovered and should not
  // keep the production status page in a misleading error state.
  const latestRunsByJob = new Map<string, Run>();
  for (const run of runs) {
    if (!latestRunsByJob.has(run.job)) latestRunsByJob.set(run.job, run);
  }
  const recentFailure = [...latestRunsByJob.values()].find(
    (run) => run.error_message,
  );
  return Response.json({
    github,
    supabase,
    repository_count: repositoryCount,
    snapshot_count: snapshotCount,
    last_discovery_at:
      discoveryRun?.completed_at ?? discoveryRun?.started_at ?? null,
    last_snapshot_at: lastSnapshot,
    github_rate_limit: githubRate,
    recent_error: recentFailure?.error_message ?? errors.at(-1) ?? null,
    recall_status: recallStatus,
    discovery_status: discoveryRun
      ? {
          source_counts: discoveryRun.discovery_source_counts ?? {},
          tier_request_counts: discoveryRun.query_tier_counts ?? {},
        }
      : null,
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: 'Forbidden origin' }, { status: 403 });
  try {
    const { action } = (await request.json()) as { action?: string };
    if (action === 'discover') return Response.json(await discover());
    if (action === 'snapshot') return Response.json(await snapshot());
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('admin_collector_failed', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
