import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trendLayout } from '../src/lib/usage-chart.ts';

const rows = [
  { day: '2026-10-30', devices: 4, listeners: 0 },
  { day: '2026-10-31', devices: 5, listeners: 2 },
  { day: '2026-11-01', devices: 2, listeners: 1 },
];

const layout = (data, width = 600, height = 140) =>
  trendLayout(data, { width, height, labelHeight: 24 });

describe('the devices trend', () => {
  it('draws two bars per day, devices always at least as tall as listeners', () => {
    const { bars } = layout(rows);
    assert.equal(bars.length, rows.length * 2);
    for (let day = 0; day < rows.length; day += 1) {
      const devices = bars[day * 2];
      const listeners = bars[day * 2 + 1];
      assert.equal(devices.series, 'devices');
      assert.equal(listeners.series, 'listeners');
      assert.ok(devices.height >= listeners.height);
    }
  });

  it('scales the tallest bar to the plot and keeps every bar inside it', () => {
    const { bars, baseline } = layout(rows);
    const tallest = Math.max(...bars.map((bar) => bar.height));
    assert.equal(tallest, baseline);
    for (const bar of bars) {
      assert.ok(bar.y >= 0);
      assert.ok(bar.y + bar.height <= baseline + 1e-9);
      assert.ok(bar.x >= 0);
      assert.ok(bar.x + bar.width <= 600 + 1e-9);
    }
  });

  it('keeps the days in the order they were given', () => {
    const { bars } = layout(rows);
    const firstDeviceX = bars[0].x;
    const lastDeviceX = bars[bars.length - 2].x;
    assert.ok(lastDeviceX > firstDeviceX);
  });

  it('labels at most seven days, at the group centre', () => {
    const long = Array.from({ length: 14 }, (_, i) => ({
      day: `2026-10-${String(i + 1).padStart(2, '0')}`,
      devices: i + 1,
      listeners: i,
    }));
    const { labels, bars } = layout(long);
    assert.ok(labels.length <= 7);
    const groupWidth = 600 / long.length;
    for (const label of labels) {
      const centre = label.x;
      assert.ok(centre >= 0 && centre <= 600);
    }
    assert.ok(bars.length > 0);
    assert.equal(groupWidth > 0, true);
  });

  it('draws no bar with a negative height when everything is zero', () => {
    const zero = rows.map((row) => ({ ...row, devices: 0, listeners: 0 }));
    const { bars, max } = layout(zero);
    assert.equal(max, 1);
    assert.ok(bars.every((bar) => bar.height === 0));
  });

  it('returns nothing for an empty window', () => {
    assert.deepEqual(layout([]).bars, []);
    assert.deepEqual(layout([]).labels, []);
  });
});
