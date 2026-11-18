/** Only a name the backup job itself writes can be listed or downloaded. */
export const SNAPSHOT_PATTERN = /^tilawa-admin-\d{8}T\d{6}Z\.sqlite$/;

/**
 * Exact host matching, case-insensitive.
 *
 * A suffix check would accept `pharmacyserver.evil`, and a substring check would
 * accept anything containing the allowed name. The list is the whole authority:
 * an empty or unparsable entry never matches.
 */
export function isAllowedHost(host: string, allowedCsv: string): boolean {
  const candidate = host.trim().toLowerCase();
  if (!candidate) return false;
  const allowed = allowedCsv
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(candidate);
}

export function isSnapshotName(name: string): boolean {
  return SNAPSHOT_PATTERN.test(name);
}
