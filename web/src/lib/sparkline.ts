/** Geometry of the monthly sparklines of a profile (thin columns on a baseline). */

export interface SparkBar {
  x: number;
  y: number;
  width: number;
  height: number;
  mes: string;
  valor: number;
}

export interface SparkOptions {
  width: number;
  height: number;
  /** Fixed top of the scale (1 for proportions); otherwise the maximum of the series. */
  max?: number;
  /** Draw a minimal mark for a value of zero (a month with votes and none cast). */
  marcarCeros?: boolean;
}

/** One column per month with data. Months without data (null) leave a gap. */
export function sparkBars(
  values: readonly (number | null)[],
  meses: readonly string[],
  options: SparkOptions,
): SparkBar[] {
  const n = values.length;
  if (n === 0) return [];
  const step = options.width / n;
  const width = Math.max(1, Math.min(6, step - 2));
  const top = options.max ?? Math.max(1e-9, ...values.map((value) => value ?? 0));
  const bars: SparkBar[] = [];
  values.forEach((value, i) => {
    if (value === null || (value === 0 && !options.marcarCeros)) return;
    const height = Math.max(value === 0 ? 1 : 2, Math.min(1, value / top) * options.height);
    bars.push({
      x: round(i * step + (step - width) / 2),
      y: round(options.height - height),
      width: round(width),
      height: round(height),
      mes: meses[i] ?? '',
      valor: value,
    });
  });
  return bars;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
