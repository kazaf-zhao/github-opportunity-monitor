import type { RepositoryCategory, RepositoryOpportunity } from './repositories';

const NOISE_CATEGORIES = new Set<RepositoryCategory>([
  'Crypto/Web3',
  'Trading',
]);

function isStrongNoiseOpportunity(row: RepositoryOpportunity) {
  return (
    (row.stars_24h ?? Number.NEGATIVE_INFINITY) >= 100 ||
    (row.relative_growth_24h ?? Number.NEGATIVE_INFINITY) >= 0.1 ||
    (row.acceleration ?? Number.NEGATIVE_INFINITY) >= 2
  );
}

/** Keep ordinary Crypto/Trading entries below 25%; verified strong movers are exempt. */
export function applyCategoryGuard(
  ranked: RepositoryOpportunity[],
  targetSize: number,
) {
  if (targetSize <= 0) return [];
  const selected: RepositoryOpportunity[] = [];
  const maxNoise = Math.floor(targetSize * 0.25);
  let noiseCount = 0;
  for (const row of ranked) {
    if (selected.length >= targetSize) break;
    const isNoise = NOISE_CATEGORIES.has(row.category);
    if (isNoise && !isStrongNoiseOpportunity(row) && noiseCount >= maxNoise)
      continue;
    selected.push(row);
    if (isNoise) noiseCount++;
  }
  return selected;
}
