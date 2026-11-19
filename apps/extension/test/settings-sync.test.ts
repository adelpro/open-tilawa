import { describe, expect, test } from 'vitest';

import { DEFAULTS, type Settings } from '../src/lib/settings';
import { planSettingsWrite, settingsFingerprint } from '../src/lib/settings-sync';

/**
 * The options page used to save the whole settings record after every state
 * change, including the echo of someone else's write. Two tabs then fought:
 * the popup set Follow, the page wrote its stale Mixed back, the write woke the
 * page again. The page may only write what it changed.
 */
const base: Settings = { ...DEFAULTS };

describe('planSettingsWrite', () => {
  test('a record already in storage is not written back', () => {
    const last = settingsFingerprint(base, '1');
    expect(planSettingsWrite(base, '1', last)).toEqual({ write: false, fingerprint: last });
  });

  test('an external change adopted into state is never echoed back', () => {
    const external: Settings = { ...base, mode: 'follow', paused: true };
    const last = settingsFingerprint(external, '1');
    expect(planSettingsWrite(external, '1', last).write).toBe(false);
  });

  test('a local change writes once and then goes quiet', () => {
    const first = planSettingsWrite({ ...base, mode: 'manual' }, '1', settingsFingerprint(base, '1'));
    expect(first.write).toBe(true);
    expect(planSettingsWrite({ ...base, mode: 'manual' }, '1', first.fingerprint).write).toBe(false);
  });

  test('the upload draft is written as the number it parses to', () => {
    const decision = planSettingsWrite(base, '2', settingsFingerprint(base, '1'));
    expect(decision.write).toBe(true);
    expect(decision.fingerprint).toBe(settingsFingerprint({ ...base, uploadMbps: 2 }, '2'));
  });

  test('before anything is known the page writes', () => {
    expect(planSettingsWrite(base, '1', null).write).toBe(true);
  });
});
