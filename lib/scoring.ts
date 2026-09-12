export type ScoreMetrics = {
  starGrowth: number;
  forkGrowth: number;
  repositoryAgeDays: number;
  commits30d: number;
  communityActivity: number;
  breakoutMomentum: number;
};
export const DEFAULT_WEIGHTS = {
  starGrowth: 0.3,
  forkGrowth: 0.15,
  repositoryAge: 0.15,
  developmentActivity: 0.15,
  communityActivity: 0.1,
  breakoutMomentum: 0.15,
} as const;
const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
export function normalizeMetrics(m: ScoreMetrics) {
  return {
    starGrowth: clamp(Math.log1p(m.starGrowth) * 18),
    forkGrowth: clamp(Math.log1p(m.forkGrowth) * 22),
    repositoryAge: clamp(100 - m.repositoryAgeDays / 3.65),
    developmentActivity: clamp(m.commits30d * 2.5),
    communityActivity: clamp(Math.log1p(m.communityActivity) * 24),
    breakoutMomentum: clamp(m.breakoutMomentum),
  };
}
export function opportunityScore(
  m: ScoreMetrics,
  w: Record<
    keyof ReturnType<typeof normalizeMetrics>,
    number
  > = DEFAULT_WEIGHTS,
) {
  const n = normalizeMetrics(m);
  return Math.round(
    Object.keys(w).reduce(
      (sum, key) => sum + n[key as keyof typeof n] * w[key as keyof typeof w],
      0,
    ),
  );
}
export function detectSignals(input: {
  stars: number;
  ageDays: number;
  stars24h: number;
  currentVelocity: number;
  previousVelocity: number;
  forks: number;
}) {
  const out: string[] = [];
  const baseline = Math.max(input.previousVelocity, 0.2);
  if (input.currentVelocity / baseline >= 2.25 && input.stars24h >= 50)
    out.push('BREAKOUT');
  if (input.currentVelocity > baseline * 1.35) out.push('ACCELERATING');
  if (input.ageDays < 30 && input.stars24h >= 50) out.push('NEW & HOT');
  if (input.stars > 0 && input.forks / input.stars >= 0.12)
    out.push('HIGH CONVERSION');
  if (input.stars < 2000 && input.currentVelocity >= 4)
    out.push('EARLY SIGNAL');
  return out;
}
