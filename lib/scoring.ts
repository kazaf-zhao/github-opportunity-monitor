import type { Signal } from './repositories';

export const OPPORTUNITY_WEIGHTS = {
  starVelocity: 0.3,
  acceleration: 0.2,
  relativeGrowth: 0.15,
  repositoryAge: 0.1,
  developmentActivity: 0.1,
  forkStarRatio: 0.05,
  communityActivity: 0.05,
  earlyStageBonus: 0.05,
} as const;

export type OpportunityInputs = {
  velocity: number | null;
  acceleration: number | null;
  relativeGrowth24h: number | null;
  ageDays: number;
  stars: number;
  stars24h: number | null;
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
      relativeGrowth:
        item.relativeGrowth24h === null
          ? 0
          : clamp01(Math.max(0, item.relativeGrowth24h) / 0.25),
      repositoryAge: clamp01(1 - item.ageDays / 365),
      forkStarRatio: clamp01(item.forkStarRatio / 0.2),
      developmentActivity: clamp01(1 - item.pushedRecencyHours / (24 * 30)),
      communityActivity: clamp01(item.communityRatio / 0.05),
      earlyStageBonus:
        item.stars24h !== null && item.stars < 2000 && item.stars24h >= 50
          ? 1
          : item.stars24h !== null && item.stars < 500 && item.stars24h >= 20
            ? 0.7
            : 0,
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
  relativeGrowth24h: number | null;
  acceleration: number | null;
  forkStarRatio: number;
  highConversionRatio: number;
}): Signal[] {
  const signals: Signal[] = [];
  const accelerating =
    input.acceleration !== null &&
    input.acceleration >= 1.5 &&
    input.stars24h !== null &&
    input.stars24h > 0;

  if (
    input.stars24h !== null &&
    input.relativeGrowth24h !== null &&
    ((input.stars24h >= 100 && input.relativeGrowth24h >= 0.05) ||
      (input.stars24h >= 50 &&
        input.acceleration !== null &&
        input.acceleration >= 2 &&
        input.stars < 5000))
  )
    signals.push('BREAKOUT');
  if (accelerating) signals.push('ACCELERATING');
  if (
    input.stars24h !== null &&
    input.relativeGrowth24h !== null &&
    input.ageDays <= 30 &&
    input.stars24h >= 20 &&
    input.relativeGrowth24h >= 0.03
  )
    signals.push('NEW & HOT');
  if (
    input.stars > 0 &&
    input.forkStarRatio >= input.highConversionRatio &&
    input.forkStarRatio >= 0.08
  )
    signals.push('HIGH CONVERSION');
  if (
    input.stars24h !== null &&
    input.relativeGrowth24h !== null &&
    input.stars < 2000 &&
    input.stars24h >= 20 &&
    input.relativeGrowth24h >= 0.05
  )
    signals.push('EARLY SIGNAL');
  return signals;
}
