import type { Signal } from './repositories';

export const OPPORTUNITY_WEIGHTS = {
  starVelocity: 0.35,
  acceleration: 0.2,
  repositoryAge: 0.15,
  forkStarRatio: 0.1,
  developmentActivity: 0.1,
  communityActivity: 0.1,
} as const;

export type OpportunityInputs = {
  velocity: number | null;
  acceleration: number | null;
  ageDays: number;
  forkStarRatio: number;
  pushedRecencyHours: number;
  communityRatio: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function scoreOpportunities(inputs: OpportunityInputs[]) {
  return inputs.map((item) => {
    const normalized = {
      starVelocity:
        item.velocity === null
          ? 0
          : clamp01(Math.log1p(Math.max(0, item.velocity)) / Math.log1p(50)),
      acceleration:
        item.acceleration === null ? 0 : clamp01((item.acceleration - 1) / 3),
      repositoryAge: clamp01(1 - item.ageDays / 365),
      forkStarRatio: clamp01(item.forkStarRatio / 0.2),
      developmentActivity: clamp01(1 - item.pushedRecencyHours / (24 * 30)),
      communityActivity: clamp01(item.communityRatio / 0.05),
    };
    return Math.round(
      clamp01(
        Object.entries(OPPORTUNITY_WEIGHTS).reduce(
          (sum, [key, weight]) =>
            sum + normalized[key as keyof typeof normalized] * weight,
          0,
        ),
      ) * 100,
    );
  });
}

export function highConversionThreshold(ratios: number[]) {
  const sorted = ratios.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return Number.POSITIVE_INFINITY;
  return sorted[Math.floor((sorted.length - 1) * 0.8)];
}

export function detectSignals(input: {
  stars: number;
  ageDays: number;
  stars24h: number | null;
  currentVelocity24h: number | null;
  previousVelocity24h: number | null;
  forkStarRatio: number;
  highConversionRatio: number;
}): Signal[] {
  const signals: Signal[] = [];
  const hasComparison =
    input.currentVelocity24h !== null && input.previousVelocity24h !== null;
  const accelerating =
    hasComparison &&
    input.currentVelocity24h! >= input.previousVelocity24h! * 1.5 &&
    input.currentVelocity24h! > 0;

  if (input.stars24h !== null && input.stars24h >= 100 && accelerating)
    signals.push('BREAKOUT');
  if (accelerating) signals.push('ACCELERATING');
  if (input.stars24h !== null && input.ageDays <= 30 && input.stars24h >= 50)
    signals.push('NEW & HOT');
  if (
    input.stars > 0 &&
    input.forkStarRatio >= input.highConversionRatio &&
    input.forkStarRatio >= 0.08
  )
    signals.push('HIGH CONVERSION');
  if (input.stars24h !== null && input.stars < 2000 && input.stars24h >= 30)
    signals.push('EARLY SIGNAL');
  return signals;
}
