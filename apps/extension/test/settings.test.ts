import { describe, expect, test } from 'vitest';

import { DEFAULTS, parseSettings, parseUploadMbps } from '../src/lib/settings';

describe('parseUploadMbps', () => {
  test('a zero upload cap pauses uploading, it does not become the default', () => {
    expect(parseUploadMbps(0)).toBe(0);
  });

  test('an empty or garbage cap falls back to 1 Mbps, never to unlimited', () => {
    expect(parseUploadMbps('')).toBe(1);
    expect(parseUploadMbps('fast')).toBe(1);
    expect(parseUploadMbps(-3)).toBe(1);
    expect(parseUploadMbps(undefined)).toBe(1);
  });

  test('a real number survives and is clamped to the maximum', () => {
    expect(parseUploadMbps(4)).toBe(4);
    expect(parseUploadMbps(5000)).toBe(1000);
  });
});

describe('parseSettings', () => {
  test('unknown or partial settings resolve to defaults field by field', () => {
    expect(parseSettings({ maxReciters: 'many' })).toEqual({ ...DEFAULTS, maxReciters: 3 });
    expect(parseSettings({ uploadMbps: 4 }).uploadMbps).toBe(4);
  });

  test('nothing at all is the defaults', () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings(undefined)).toEqual(DEFAULTS);
  });

  test('the reciter count is clamped to the roster range', () => {
    expect(parseSettings({ maxReciters: 0 }).maxReciters).toBe(1);
    expect(parseSettings({ maxReciters: 99 }).maxReciters).toBe(12);
  });

  test('a schedule is kept only when both hours are real', () => {
    expect(parseSettings({ schedule: { from: 22, to: 7 } }).schedule).toEqual({ from: 22, to: 7 });
    expect(parseSettings({ schedule: { from: 22, to: 99 } }).schedule).toBeNull();
    expect(parseSettings({ schedule: 'night' }).schedule).toBeNull();
  });

  test('a paused flag survives a round trip', () => {
    expect(parseSettings({ paused: true }).paused).toBe(true);
    expect(parseSettings({ paused: 'yes' }).paused).toBe(false);
  });
});

describe('listening modes', () => {
  test('a fresh install starts mixed, holding 3 manual picks and 2 followed', () => {
    expect(parseSettings({}).mode).toBe('mixed');
    expect(parseSettings({}).followCap).toBe(2);
    expect(parseSettings({}).maxReciters).toBe(3);
    expect(DEFAULTS.mode).toBe('mixed');
    expect(DEFAULTS.followCap).toBe(2);
    expect(DEFAULTS.maxReciters).toBe(3);
  });

  test('a known mode survives; an unknown one falls back to the default', () => {
    expect(parseSettings({ mode: 'mixed' }).mode).toBe('mixed');
    expect(parseSettings({ mode: 'follow' }).mode).toBe('follow');
    expect(parseSettings({ mode: 'manual' }).mode).toBe('manual');
    expect(parseSettings({ mode: 'auto' }).mode).toBe('mixed');
    expect(parseSettings({ mode: 42 }).mode).toBe('mixed');
  });

  test('the follow cap accepts 0 (following off) and clamps to 6', () => {
    expect(parseSettings({ followCap: 0 }).followCap).toBe(0);
    expect(parseSettings({ followCap: 4 }).followCap).toBe(4);
    expect(parseSettings({ followCap: 9 }).followCap).toBe(2);
    expect(parseSettings({ followCap: -1 }).followCap).toBe(2);
    expect(parseSettings({ followCap: 2.5 }).followCap).toBe(2);
  });
});

describe('the disk budget', () => {
  test('defaults to 10 GB and keeps 0 meaning "no limit"', () => {
    expect(parseSettings({}).maxDiskGb).toBe(10);
    expect(DEFAULTS.maxDiskGb).toBe(10);
    expect(parseSettings({ maxDiskGb: 0 }).maxDiskGb).toBe(0);
    expect(parseSettings({ maxDiskGb: 25 }).maxDiskGb).toBe(25);
  });

  test('garbage and out-of-range values fall back to the default, never unlimited', () => {
    expect(parseSettings({ maxDiskGb: -1 }).maxDiskGb).toBe(10);
    expect(parseSettings({ maxDiskGb: 1.5 }).maxDiskGb).toBe(10);
    expect(parseSettings({ maxDiskGb: 9999 }).maxDiskGb).toBe(10);
    expect(parseSettings({ maxDiskGb: 'lots' }).maxDiskGb).toBe(10);
  });
});
