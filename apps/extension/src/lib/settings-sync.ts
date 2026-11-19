/**
 * What the options page is allowed to write.
 *
 * Settings have two other writers: the popup (mode, disk, pause) and the
 * background (pause). So the page saves only when its own state differs from
 * the record it last saw in storage.
 *
 * Writing the whole record after every state change — the old behaviour — made
 * two tabs fight: the popup set Follow, the page saved its stale Mixed back,
 * that write arrived as an external change, and the page saved again, once per
 * debounce, for as long as the tab stayed open. The fix is one comparison, kept
 * pure here so the rule can be tested without a browser.
 */

import { parseUploadMbps, type Settings } from './settings';

/** One string for the record this page would write, draft included. */
export function settingsFingerprint(settings: Settings, uploadDraft: string): string {
  return JSON.stringify({ ...settings, uploadMbps: parseUploadMbps(uploadDraft) });
}

export type SettingsWrite = { write: boolean; fingerprint: string };

/**
 * `lastFingerprint` is the record this page believes is in storage — written by
 * it, or adopted from someone else. An equal record is never sent back.
 */
export function planSettingsWrite(
  settings: Settings,
  uploadDraft: string,
  lastFingerprint: string | null,
): SettingsWrite {
  const fingerprint = settingsFingerprint(settings, uploadDraft);
  return { write: fingerprint !== lastFingerprint, fingerprint };
}
