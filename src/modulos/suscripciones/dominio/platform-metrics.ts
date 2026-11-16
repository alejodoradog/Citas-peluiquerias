// The charts of P-06 on a computer (task 7.12): one series each, as bars
// that start at zero. The database counts (platform_weekly_activity,
// platform_monthly_revenue); here each value gets its height.

export type ChartPoint = {
  // The week's Monday or the month's first day (AAAA-MM-DD).
  start: string;
  value: number;
};

export type ChartBar = ChartPoint & {
  // The bar's height, from 0 to 1 of the tallest one.
  share: number;
};

export function chartBars(points: readonly ChartPoint[]): ChartBar[] {
  const max = Math.max(0, ...points.map((p) => p.value));
  return points.map((p) => ({
    ...p,
    share: max > 0 ? Math.max(0, p.value) / max : 0,
  }));
}

// The total of a series, for the chart's summary line.
export function seriesTotal(points: readonly ChartPoint[]): number {
  return points.reduce((sum, p) => sum + p.value, 0);
}
