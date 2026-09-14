import type {
  CommercialAnalysis,
  RecallSource,
  RepositoryCategory,
  RepositoryApiResponse,
  RepositoryOpportunity,
  VelocitySource,
} from './repositories';
import { applyCategoryGuard } from './category-ranking';
import {
  detectSignals,
  highConversionThreshold,
  scoreOpportunities,
  type OpportunityInputs,
} from './scoring';
import { supabaseCount, supabaseRequest } from './supabase';

type RepositoryRow = Omit<
  RepositoryOpportunity,
  | 'repository_age_days'
  | 'stars_1h'
  | 'stars_6h'
  | 'stars_24h'
  | 'stars_7d'
  | 'stars_30d'
  | 'relative_growth_24h'
  | 'velocity'
  | 'velocity_source'
  | 'acceleration'
  | 'opportunity_score'
  | 'signals'
  | 'recall_sources'
  | 'spark'
  | 'spark_timestamps'
  | 'commercial'
>;
export type SnapshotRow = {
  repository_id: string;
  stars: number;
  forks: number;
  open_issues: number;
  captured_at: string;
};
type RecallSeed = { id: string; stars: number };
type SnapshotMetricRow = {
  repository_id: string;
  current_stars: number;
  stars_1h: number | null;
  stars_6h: number | null;
  stars_24h: number | null;
  stars_7d: number | null;
  stars_30d: number | null;
  relative_growth_24h: number | null;
  velocity: number | null;
  velocity_source: VelocitySource;
  acceleration: number | null;
};
type MetricRecallRow = SnapshotMetricRow & {
  recall_source: Extract<
    RecallSource,
    'star_spike' | 'high_acceleration' | 'high_relative_growth'
  >;
};
type Candidate = {
  id: string;
  stars: number;
  recall_sources: Set<RecallSource>;
  recallMetric?: MetricRecallRow;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_CANDIDATES = 2000;
const EMPTY_SOURCE_COUNTS: Record<RecallSource, number> = {
  recent_created: 0,
  recent_active: 0,
  small_repo: 0,
  early_stage: 0,
  star_spike: 0,
  high_acceleration: 0,
  high_relative_growth: 0,
};

export function pointAtOrBefore(
  points: SnapshotRow[],
  targetTime: number,
  maxDeviation: number,
) {
  for (let index = points.length - 1; index >= 0; index--) {
    const capturedAt = Date.parse(points[index].captured_at);
    if (capturedAt <= targetTime)
      return targetTime - capturedAt <= maxDeviation ? points[index] : null;
  }
  return null;
}

function sample(points: SnapshotRow[], maxPoints = 48) {
  if (points.length <= maxPoints) return points;
  const stride = (points.length - 1) / (maxPoints - 1);
  return Array.from(
    { length: maxPoints },
    (_, index) => points[Math.round(index * stride)],
  );
}

async function loadSnapshots(repositoryIds: string[], days: number) {
  const all: SnapshotRow[] = [];
  for (let start = 0; start < repositoryIds.length; start += 20) {
    const ids = repositoryIds.slice(start, start + 20).join(',');
    for (let offset = 0; ; offset += 1000) {
      const page = await supabaseRequest<SnapshotRow[]>(
        `repository_snapshots?select=repository_id,stars,forks,open_issues,captured_at&repository_id=in.(${ids})&captured_at=gte.${encodeURIComponent(new Date(Date.now() - days * DAY).toISOString())}&order=captured_at.asc&limit=1000&offset=${offset}`,
      );
      all.push(...page);
      if (page.length < 1000) break;
    }
  }
  return all;
}

async function recallCandidates() {
  const now = Date.now();
  const created90d = encodeURIComponent(new Date(now - 90 * DAY).toISOString());
  const created180d = encodeURIComponent(
    new Date(now - 180 * DAY).toISOString(),
  );
  const pushed30d = encodeURIComponent(new Date(now - 30 * DAY).toISOString());
  const [recentCreated, recentActive, smallRepo, earlyStage, metricRows] =
    await Promise.all([
      supabaseRequest<RecallSeed[]>(
        `repositories?select=id,stars&archived=eq.false&created_at=gte.${created90d}&stars=gte.1&order=created_at.desc&limit=300`,
      ),
      supabaseRequest<RecallSeed[]>(
        `repositories?select=id,stars&archived=eq.false&pushed_at=gte.${pushed30d}&order=pushed_at.desc&limit=300`,
      ),
      supabaseRequest<RecallSeed[]>(
        'repositories?select=id,stars&archived=eq.false&stars=gte.20&stars=lt.5000&order=last_snapshot_at.desc.nullslast&limit=300',
      ),
      supabaseRequest<RecallSeed[]>(
        `repositories?select=id,stars&archived=eq.false&stars=lt.2000&created_at=gte.${created180d}&order=created_at.desc&limit=300`,
      ),
      supabaseRequest<MetricRecallRow[]>(
        'rpc/get_opportunity_metric_recall',
        'POST',
        {},
      ),
    ]);
  const metricBySource = {
    star_spike: metricRows.filter((row) => row.recall_source === 'star_spike'),
    high_acceleration: metricRows.filter(
      (row) => row.recall_source === 'high_acceleration',
    ),
    high_relative_growth: metricRows.filter(
      (row) => row.recall_source === 'high_relative_growth',
    ),
  };
  const sourceCounts: Record<RecallSource, number> = {
    ...EMPTY_SOURCE_COUNTS,
    recent_created: recentCreated.length,
    recent_active: recentActive.length,
    small_repo: smallRepo.length,
    early_stage: earlyStage.length,
    star_spike: metricBySource.star_spike.length,
    high_acceleration: metricBySource.high_acceleration.length,
    high_relative_growth: metricBySource.high_relative_growth.length,
  };
  const candidateMap = new Map<string, Candidate>();
  const add = (
    source: RecallSource,
    rows: Array<RecallSeed | MetricRecallRow>,
  ) => {
    for (const row of rows) {
      const id = 'id' in row ? row.id : row.repository_id;
      const stars = 'stars' in row ? row.stars : row.current_stars;
      const candidate = candidateMap.get(id) ?? {
        id,
        stars,
        recall_sources: new Set<RecallSource>(),
      };
      candidate.recall_sources.add(source);
      if ('recall_source' in row) candidate.recallMetric = row;
      candidateMap.set(id, candidate);
    }
  };
  add('star_spike', metricBySource.star_spike);
  add('high_acceleration', metricBySource.high_acceleration);
  add('high_relative_growth', metricBySource.high_relative_growth);
  add('early_stage', earlyStage);
  add('recent_created', recentCreated);
  add('recent_active', recentActive);
  add('small_repo', smallRepo);

  const deduplicatedCount = candidateMap.size;
  const eligible = [...candidateMap.values()].filter((candidate) => {
    if (candidate.stars <= 50_000) return true;
    return (
      (candidate.recallMetric?.stars_24h ?? Number.NEGATIVE_INFINITY) >= 300 ||
      (candidate.recallMetric?.acceleration ?? Number.NEGATIVE_INFINITY) >= 2
    );
  });
  const nonMature = eligible.filter((candidate) => candidate.stars <= 50_000);
  const mature = eligible.filter((candidate) => candidate.stars > 50_000);
  const matureLimit = Math.min(
    mature.length,
    Math.floor(nonMature.length / 4),
    Math.floor(MAX_CANDIDATES * 0.2),
  );
  const nonMatureLimit = Math.min(
    nonMature.length,
    MAX_CANDIDATES - matureLimit,
  );
  const expectedSize = nonMatureLimit + matureLimit;
  const earlyTarget = Math.min(
    nonMature.filter((candidate) => candidate.stars < 2000).length,
    Math.ceil(expectedSize * 0.3),
  );
  const selected: Candidate[] = [];
  const selectedIds = new Set<string>();
  for (const candidate of nonMature) {
    if (selected.length >= earlyTarget) break;
    if (candidate.stars < 2000) {
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  }
  for (const candidate of nonMature) {
    if (selected.length >= nonMatureLimit) break;
    if (selectedIds.has(candidate.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.id);
  }
  for (const candidate of mature.slice(0, matureLimit)) {
    selected.push(candidate);
    selectedIds.add(candidate.id);
  }
  return { selected, sourceCounts, deduplicatedCount };
}

async function loadRepositoryRows(ids: string[]) {
  const rows: RepositoryRow[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    rows.push(
      ...(await supabaseRequest<RepositoryRow[]>(
        `repositories?select=id,github_id,owner,name,full_name,description,description_zh,github_url,stars,forks,open_issues,primary_language,topics,category,discovery_sources,created_at,pushed_at,updated_at,last_snapshot_at&id=in.(${ids.slice(start, start + 100).join(',')})`,
      )),
    );
  }
  return rows;
}

async function loadSnapshotMetrics(ids: string[]) {
  const rows: SnapshotMetricRow[] = [];
  for (let start = 0; start < ids.length; start += 500) {
    rows.push(
      ...(await supabaseRequest<SnapshotMetricRow[]>(
        'rpc/get_repository_snapshot_metrics',
        'POST',
        { candidate_ids: ids.slice(start, start + 500) },
      )),
    );
  }
  return rows;
}

async function loadCommercialAnalyses(ids: string[]) {
  const rows: CommercialAnalysis[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    rows.push(
      ...(await supabaseRequest<CommercialAnalysis[]>(
        `commercial_analyses?select=repository_id,analysis_version,analyzed_at,issue_window_start,demand_score,commercial_score,indie_score,competition_gap,money_score,opportunity_types,monetization_ideas,why_now,user_pain,what_to_build,who_pays,monetization,difficulty,estimated_mvp,evidence&repository_id=in.(${ids.slice(start, start + 100).join(',')})`,
      )),
    );
  }
  return rows;
}

async function recordRecallStatus(
  sourceCounts: Record<RecallSource, number>,
  candidateCount: number,
  deduplicatedCount: number,
  categoryPoolCounts: Partial<Record<RepositoryCategory, number>>,
  top50CategoryCounts: Partial<Record<RepositoryCategory, number>>,
  categoryBias: Array<{
    category: RepositoryCategory;
    pool_share: number;
    top50_share: number;
    ratio: number;
  }>,
) {
  try {
    await supabaseRequest(
      'candidate_recall_status?on_conflict=id',
      'POST',
      {
        id: true,
        source_counts: sourceCounts,
        candidate_count: candidateCount,
        deduplicated_count: deduplicatedCount,
        category_pool_counts: categoryPoolCounts,
        top50_category_counts: top50CategoryCounts,
        category_bias: categoryBias,
        computed_at: new Date().toISOString(),
      },
      'resolution=merge-duplicates,return=representation',
    );
  } catch (error) {
    console.warn('recall_status_log_failed', error);
  }
}

function categoryCounts(rows: RepositoryOpportunity[]) {
  const counts: Partial<Record<RepositoryCategory, number>> = {};
  for (const row of rows)
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

function categoryBias(
  poolCounts: Partial<Record<RepositoryCategory, number>>,
  topCounts: Partial<Record<RepositoryCategory, number>>,
  poolTotal: number,
  topTotal: number,
) {
  if (!poolTotal || !topTotal) return [];
  return (Object.keys(poolCounts) as RepositoryCategory[])
    .map((category) => {
      const poolShare = (poolCounts[category] ?? 0) / poolTotal;
      const topShare = (topCounts[category] ?? 0) / topTotal;
      return {
        category,
        pool_share: poolShare,
        top50_share: topShare,
        ratio: poolShare > 0 ? topShare / poolShare : 0,
      };
    })
    .filter((item) => item.ratio >= 2)
    .sort((a, b) => b.ratio - a.ratio);
}

export function dataStatus(lastSnapshotAt: string | null) {
  if (!lastSnapshotAt) return 'WAITING' as const;
  const age = Date.now() - Date.parse(lastSnapshotAt);
  if (age <= 30 * 60_000) return 'LIVE' as const;
  if (age <= 2 * HOUR) return 'RECENT' as const;
  return 'STALE' as const;
}

export async function getRepositoryOpportunities(options?: {
  limit?: number;
  offset?: number;
  owner?: string;
  repo?: string;
  includeSpark?: boolean;
  includeCommercial?: boolean;
  applyCategoryLimit?: boolean;
}): Promise<RepositoryApiResponse> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const offset = Math.max(options?.offset ?? 0, 0);
  const isDetail = Boolean(options?.owner && options?.repo);
  let sourceCounts = { ...EMPTY_SOURCE_COUNTS };
  let deduplicatedCount = 0;
  let candidates: Candidate[];

  if (isDetail) {
    const rows = await supabaseRequest<RecallSeed[]>(
      `repositories?select=id,stars&owner=eq.${encodeURIComponent(options!.owner!)}&name=eq.${encodeURIComponent(options!.repo!)}&limit=1`,
    );
    candidates = rows.map((row) => ({
      ...row,
      recall_sources: new Set<RecallSource>(),
    }));
    deduplicatedCount = candidates.length;
  } else {
    const recalled = await recallCandidates();
    candidates = recalled.selected;
    sourceCounts = recalled.sourceCounts;
    deduplicatedCount = recalled.deduplicatedCount;
  }

  const candidateById = new Map(candidates.map((item) => [item.id, item]));
  const ids = candidates.map((candidate) => candidate.id);
  const recalledMetricMap = new Map<string, SnapshotMetricRow>();
  for (const candidate of candidates) {
    if (candidate.recallMetric)
      recalledMetricMap.set(candidate.id, candidate.recallMetric);
  }
  const missingMetricIds = ids.filter((id) => !recalledMetricMap.has(id));
  const [rows, missingMetricRows] = await Promise.all([
    loadRepositoryRows(ids),
    loadSnapshotMetrics(missingMetricIds),
  ]);
  const metricById = new Map(
    [...recalledMetricMap.values(), ...missingMetricRows].map((metric) => [
      metric.repository_id,
      metric,
    ]),
  );
  const now = Date.now();
  const inputs: OpportunityInputs[] = rows.map((row) => {
    const metric = metricById.get(row.id);
    const ageDays = Math.max(
      0,
      Math.floor((now - Date.parse(row.created_at)) / DAY),
    );
    return {
      velocity: metric?.velocity ?? null,
      acceleration: metric?.acceleration ?? null,
      relativeGrowth24h: metric?.relative_growth_24h ?? null,
      ageDays,
      stars: row.stars,
      stars24h: metric?.stars_24h ?? null,
      forkStarRatio: row.stars > 0 ? row.forks / row.stars : 0,
      pushedRecencyHours: row.pushed_at
        ? Math.max(0, (now - Date.parse(row.pushed_at)) / HOUR)
        : Number.MAX_SAFE_INTEGER,
      communityRatio:
        row.stars > 0 ? row.open_issues / row.stars : row.open_issues,
    };
  });
  const scores = scoreOpportunities(inputs);
  const conversionCutoff = highConversionThreshold(
    inputs.map((input) => input.forkStarRatio),
  );
  const ranked = rows
    .map((row, index): RepositoryOpportunity => {
      const metric = metricById.get(row.id);
      const input = inputs[index];
      return {
        ...row,
        repository_age_days: input.ageDays,
        stars_1h: metric?.stars_1h ?? null,
        stars_6h: metric?.stars_6h ?? null,
        stars_24h: metric?.stars_24h ?? null,
        stars_7d: metric?.stars_7d ?? null,
        stars_30d: metric?.stars_30d ?? null,
        relative_growth_24h: metric?.relative_growth_24h ?? null,
        velocity: metric?.velocity ?? null,
        velocity_source: metric?.velocity_source ?? null,
        acceleration: metric?.acceleration ?? null,
        opportunity_score: scores[index],
        signals: detectSignals({
          stars: row.stars,
          ageDays: input.ageDays,
          stars24h: metric?.stars_24h ?? null,
          relativeGrowth24h: metric?.relative_growth_24h ?? null,
          acceleration: metric?.acceleration ?? null,
          forkStarRatio: input.forkStarRatio,
          highConversionRatio: conversionCutoff,
        }),
        recall_sources: [...(candidateById.get(row.id)?.recall_sources ?? [])],
        spark: [],
        spark_timestamps: [],
        commercial: null,
      };
    })
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const poolCategoryCounts = categoryCounts(ranked);
  const rawTop50 = ranked.slice(0, 50);
  const top50CategoryCounts = categoryCounts(rawTop50);
  const bias = categoryBias(
    poolCategoryCounts,
    top50CategoryCounts,
    ranked.length,
    rawTop50.length,
  );
  const guarded =
    isDetail || options?.applyCategoryLimit === false
      ? ranked
      : applyCategoryGuard(ranked, offset + limit);
  const rankedData = guarded.slice(offset, offset + limit);

  if (options?.includeCommercial !== false && rankedData.length) {
    const analyses = await loadCommercialAnalyses(
      rankedData.map((row) => row.id),
    );
    const byRepository = new Map(
      analyses.map((analysis) => [analysis.repository_id, analysis]),
    );
    for (const row of rankedData)
      row.commercial = byRepository.get(row.id) ?? null;
  }

  if (options?.includeSpark !== false && rankedData.length) {
    const snapshots = await loadSnapshots(
      rankedData.map((row) => row.id),
      isDetail ? 34 : 7,
    );
    const byRepository = new Map<string, SnapshotRow[]>();
    for (const point of snapshots) {
      const group = byRepository.get(point.repository_id) ?? [];
      group.push(point);
      byRepository.set(point.repository_id, group);
    }
    for (const row of rankedData) {
      const visible = sample(byRepository.get(row.id) ?? []);
      row.spark = visible.map((point) => point.stars);
      row.spark_timestamps = visible.map((point) => point.captured_at);
    }
  }

  if (!isDetail)
    await recordRecallStatus(
      sourceCounts,
      candidates.length,
      deduplicatedCount,
      poolCategoryCounts,
      top50CategoryCounts,
      bias,
    );
  const [repositoryCount, snapshotCount, latestSnapshots] = await Promise.all([
    supabaseCount('repositories'),
    supabaseCount('repository_snapshots'),
    supabaseRequest<Array<{ captured_at: string }>>(
      'repository_snapshots?select=captured_at&order=captured_at.desc&limit=1',
    ),
  ]);
  const lastSnapshotAt = latestSnapshots[0]?.captured_at ?? null;
  return {
    data: rankedData,
    meta: {
      repository_count: repositoryCount,
      snapshot_count: snapshotCount,
      last_snapshot_at: lastSnapshotAt,
      data_status: dataStatus(lastSnapshotAt),
      updated_at: new Date().toISOString(),
      recall_stats: {
        source_counts: sourceCounts,
        candidate_count: candidates.length,
        deduplicated_count: deduplicatedCount,
        category_pool_counts: poolCategoryCounts,
        top50_category_counts: top50CategoryCounts,
        category_bias: bias,
      },
    },
  };
}
