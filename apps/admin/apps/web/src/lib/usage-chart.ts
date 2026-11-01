/**
 * The geometry of the one chart on the Usage page.
 *
 * Daily devices and listeners, as grouped bars. Bars, not a wave or an area: the
 * window can be three days or fourteen, and a curve would invent the days in
 * between. Grouped rather than stacked because listeners are a subset of devices,
 * not a second layer to add to them.
 *
 * Pure on purpose: the component draws what this returns, and the tests can hold
 * the bars inside the plot without a browser.
 */

export type TrendRow = {
  day: string;
  devices: number;
  listeners: number;
};

export type TrendSeries = 'devices' | 'listeners';

export type TrendBar = {
  key: string;
  series: TrendSeries;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TrendLabel = {
  key: string;
  x: number;
  text: string;
};

export type TrendLayout = {
  bars: TrendBar[];
  labels: TrendLabel[];
  /** The value the tallest bar maps to; at least 1 so zero rows still divide. */
  max: number;
  /** The y of the baseline, where a zero bar sits. */
  baseline: number;
};

export function trendLayout(
  rows: readonly TrendRow[],
  options: { width: number; height: number; labelHeight: number; maxLabels?: number },
): TrendLayout {
  const { width, height, labelHeight, maxLabels = 7 } = options;
  const baseline = height - labelHeight;
  if (rows.length === 0) return { bars: [], labels: [], max: 1, baseline };

  // Listeners are a subset of devices today, but the max is taken over both so a
  // bug in one series cannot push a bar out of the plot.
  const max = Math.max(1, ...rows.map((row) => Math.max(row.devices, row.listeners)));

  const groupWidth = width / rows.length;
  const groupGap = groupWidth * 0.18;
  const barGap = Math.max(2, groupWidth * 0.06);
  const barWidth = Math.max(2, (groupWidth - groupGap - barGap) / 2);
  const pairWidth = barWidth * 2 + barGap;

  const bars: TrendBar[] = [];
  const labels: TrendLabel[] = [];
  // At most seven dates on the axis: enough to place the window, not a wall of
  // numerals under 30px-wide groups.
  const stride = Math.max(1, Math.ceil(rows.length / maxLabels));

  rows.forEach((row, index) => {
    const groupStart = index * groupWidth;
    const left = groupStart + (groupWidth - pairWidth) / 2;
    const heightOf = (value: number): number => (Math.max(0, value) / max) * baseline;

    const devices = heightOf(row.devices);
    const listeners = heightOf(row.listeners);

    bars.push({
      key: `${row.day}:devices`,
      series: 'devices',
      x: left,
      y: baseline - devices,
      width: barWidth,
      height: devices,
    });
    bars.push({
      key: `${row.day}:listeners`,
      series: 'listeners',
      x: left + barWidth + barGap,
      y: baseline - listeners,
      width: barWidth,
      height: listeners,
    });

    if (index % stride === 0) {
      labels.push({
        key: row.day,
        x: groupStart + groupWidth / 2,
        text: row.day.slice(5),
      });
    }
  });

  return { bars, labels, max, baseline };
}
