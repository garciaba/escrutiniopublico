/** Pure statistics used by the scoring (specification, section 7). */

/**
 * Percentile of `x` in a population given as an ascending array:
 * 100 · (#{below} + 0.5 · #{equal}) / N. Returns undefined for an empty population.
 */
export function percentile(sortedAscending: readonly number[], x: number): number | undefined {
  const n = sortedAscending.length;
  if (n === 0) return undefined;
  let low = 0;
  let high = n;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((sortedAscending[middle] ?? 0) < x) low = middle + 1;
    else high = middle;
  }
  const below = low;
  high = n;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((sortedAscending[middle] ?? 0) <= x) low = middle + 1;
    else high = middle;
  }
  const equal = low - below;
  return (100 * (below + 0.5 * equal)) / n;
}

export function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Positions for scores sorted from highest to lowest: equal scores share a position
 * and the next one skips (1, 2, 2, 4).
 */
export function competitionRanks(sortedDescending: readonly number[]): number[] {
  const ranks: number[] = [];
  sortedDescending.forEach((score, index) => {
    const previous = sortedDescending[index - 1];
    ranks.push(index > 0 && previous === score ? (ranks[index - 1] ?? index + 1) : index + 1);
  });
  return ranks;
}
