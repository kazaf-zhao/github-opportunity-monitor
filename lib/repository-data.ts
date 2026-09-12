import type {
  RepositoryApiResponse,
  RepositoryOpportunity,
  VelocitySource,
} from './repositories';
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
  | 'stars_24h'
  | 'stars_7d'
  | 'stars_30d'
  | 'relative_growth_24h'
  | 'velocity'
  | 'velocity_source'
  | 'acceleration'
  | 'opportunity_score'
  | 'signals'
  | 'spark'
  | 'spark_timestamps'
>;
type SnapshotRow = {
  repository_id: string;
  stars: number;
  forks: number;
  open_issues: number;
  captured_at: string;
};
type Derived = {
  row: RepositoryRow;
  points: SnapshotRow[];
  ageDays: number;
  stars1h: number | null;
  stars24h: number | null;
  stars7d: number | null;
  stars30d: number | null;
  relativeGrowth24h: number | null;
  velocity: number | null;
  velocitySource: VelocitySource;
  currentVelocity24h: number | null;
  previousVelocity24h: number | null;
  acceleration: number | null;
  inputs: OpportunityInputs;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WINDOW_TOLERANCE = {
  [HOUR]: 2 * HOUR,
  [6 * HOUR]: 4 * HOUR,
  [DAY]: 8 * HOUR,
  [7 * DAY]: DAY,
  [30 * DAY]: 3 * DAY,
} as const;

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

async function loadSnapshots(repositoryIds: string[]) {
  const all: SnapshotRow[] = [];
  for (let start = 0; start < repositoryIds.length; start += 20) {
    const ids = repositoryIds.slice(start, start + 20).join(',');
    for (let offset = 0; ; offset += 1000) {
      const page = await supabaseRequest<SnapshotRow[]>(
        `repository_snapshots?select=repository_id,stars,forks,open_issues,captured_at&repository_id=in.(${ids})&captured_at=gte.${encodeURIComponent(new Date(Date.now() - 34 * DAY).toISOString())}&order=captured_at.asc&limit=1000&offset=${offset}`,
      );
      all.push(...page);
      if (page.length < 1000) break;
    }
  }
  return all;
}

function derive(row: RepositoryRow, points: SnapshotRow[]): Derived {
  const now = Date.now();
  const latest = points.at(-1) ?? null;
  const pointFor = (duration: keyof typeof WINDOW_TOLERANCE) =>
    latest
      ? pointAtOrBefore(
          points,
          Date.parse(latest.captured_at) - duration,
          WINDOW_TOLERANCE[duration],
        )
      : null;
  const delta = (duration: keyof typeof WINDOW_TOLERANCE) => {
    if (!latest) return null;
    const previous = pointFor(duration);
    return previous ? latest.stars - previous.stars : null;
  };
  const stars1h = delta(HOUR);
  const stars6h = delta(6 * HOUR);
  const stars24h = delta(DAY);
  const stars7d = delta(7 * DAY);
  const stars30d = delta(30 * DAY);
  const latestTime = latest ? Date.parse(latest.captured_at) : now;
  const at24h = latest
    ? pointAtOrBefore(points, latestTime - DAY, 8 * HOUR)
    : null;
  const at48h = latest
    ? pointAtOrBefore(points, latestTime - 2 * DAY, 8 * HOUR)
    : null;
  const currentVelocity24h = stars24h === null ? null : stars24h / 24;
  const previousVelocity24h =
    at24h && at48h ? (at24h.stars - at48h.stars) / 24 : null;
  const acceleration =
    currentVelocity24h === null || previousVelocity24h === null
      ? null
      : previousVelocity24h === 0
        ? currentVelocity24h > 0
          ? 2
          : 1
        : currentVelocity24h / previousVelocity24h;
  let velocity: number | null = null;
  let velocitySource: VelocitySource = null;
  if (stars24h !== null) {
    velocity = stars24h / 24;
    velocitySource = '24h';
  } else if (stars6h !== null) {
    velocity = stars6h / 6;
    velocitySource = '6h';
  } else if (stars1h !== null) {
    velocity = stars1h;
    velocitySource = '1h';
  }
  const ageDays = Math.max(
    0,
    Math.floor((now - Date.parse(row.created_at)) / DAY),
  );
  const forkStarRatio = row.stars > 0 ? row.forks / row.stars : 0;
  const relativeGrowth24h =
    stars24h === null ? null : stars24h / Math.max(row.stars - stars24h, 1);
  const pushedRecencyHours = row.pushed_at
    ? Math.max(0, (now - Date.parse(row.pushed_at)) / HOUR)
    : Number.MAX_SAFE_INTEGER;
  return {
    row,
    points,
    ageDays,
    stars1h,
    stars24h,
    stars7d,
    stars30d,
    relativeGrowth24h,
    velocity,
    velocitySource,
    currentVelocity24h,
    previousVelocity24h,
    acceleration,
    inputs: {
      velocity,
      acceleration,
      relativeGrowth24h,
      ageDays,
      stars: row.stars,
      stars24h,
      forkStarRatio,
      pushedRecencyHours,
      communityRatio:
        row.stars > 0 ? row.open_issues / row.stars : row.open_issues,
    },
  };
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
}): Promise<RepositoryApiResponse> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const offset = Math.max(options?.offset ?? 0, 0);
  const filters = [
    options?.owner ? `owner=eq.${encodeURIComponent(options.owner)}` : '',
    options?.repo ? `name=eq.${encodeURIComponent(options.repo)}` : '',
  ].filter(Boolean);
  const now = Date.now();
  const candidateFilter = filters.length
    ? `${filters.join('&')}&`
    : `or=(created_at.gte.${encodeURIComponent(new Date(now - 90 * DAY).toISOString())},pushed_at.gte.${encodeURIComponent(new Date(now - 30 * DAY).toISOString())},stars.lt.20000)&`;
  const rows = await supabaseRequest<RepositoryRow[]>(
    `repositories?select=id,github_id,owner,name,full_name,description,description_zh,github_url,stars,forks,open_issues,primary_language,topics,created_at,pushed_at,updated_at,last_snapshot_at&${candidateFilter}order=pushed_at.desc.nullslast,created_at.desc&limit=${filters.length ? 1 : 1000}`,
  );
  const derived: Derived[] = [];
  for (let start = 0; start < rows.length; start += 20) {
    const batch = rows.slice(start, start + 20);
    const snapshots = await loadSnapshots(batch.map((row) => row.id));
    const byRepository = new Map<string, SnapshotRow[]>();
    for (const point of snapshots) {
      const group = byRepository.get(point.repository_id) ?? [];
      group.push(point);
      byRepository.set(point.repository_id, group);
    }
    for (const row of batch) {
      const item = derive(row, byRepository.get(row.id) ?? []);
      item.points = sample(item.points);
      derived.push(item);
    }
  }
  const scores = scoreOpportunities(derived.map((item) => item.inputs));
  const conversionCutoff = highConversionThreshold(
    derived.map((item) => item.inputs.forkStarRatio),
  );
  const data = derived.map((item, index): RepositoryOpportunity => {
    const visiblePoints = sample(item.points);
    return {
      ...item.row,
      repository_age_days: item.ageDays,
      stars_1h: item.stars1h,
      stars_24h: item.stars24h,
      stars_7d: item.stars7d,
      stars_30d: item.stars30d,
      relative_growth_24h: item.relativeGrowth24h,
      velocity: item.velocity,
      velocity_source: item.velocitySource,
      acceleration: item.acceleration,
      opportunity_score: scores[index],
      signals: detectSignals({
        stars: item.row.stars,
        ageDays: item.ageDays,
        stars24h: item.stars24h,
        relativeGrowth24h: item.relativeGrowth24h,
        acceleration: item.acceleration,
        currentVelocity24h: item.currentVelocity24h,
        previousVelocity24h: item.previousVelocity24h,
        forkStarRatio: item.inputs.forkStarRatio,
        highConversionRatio: conversionCutoff,
      }),
      spark: visiblePoints.map((point) => point.stars),
      spark_timestamps: visiblePoints.map((point) => point.captured_at),
    };
  });
  data.sort((a, b) => b.opportunity_score - a.opportunity_score);
  const rankedData = data.slice(offset, offset + limit);
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
    },
  };
}
