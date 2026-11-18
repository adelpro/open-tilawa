/**
 * The two table gestures that make a 240-file list usable: narrow it, then order it.
 *
 * Pure and browser-free so the empty-result and stable-order cases can be tested
 * without a DOM. A row with an unparsable date is kept rather than silently dropped:
 * a filter must not hide a file because its metadata is odd.
 */
export type SnapshotRow = { name: string; size: number; mtime: string };

export type SnapshotFilters = { query: string; olderThanDays: number | null };

export type SnapshotSort = 'newest' | 'oldest' | 'largest' | 'smallest' | 'name';

const DAY_MS = 86_400_000;

function ageDays(row: SnapshotRow, now: number): number | null {
  const at = Date.parse(row.mtime);
  return Number.isFinite(at) ? (now - at) / DAY_MS : null;
}

export function filterSnapshots(
  files: readonly SnapshotRow[],
  filters: SnapshotFilters,
  now = Date.now(),
): SnapshotRow[] {
  const query = filters.query.trim().toLowerCase();
  return files.filter((row) => {
    if (query && !row.name.toLowerCase().includes(query)) return false;
    if (filters.olderThanDays === null) return true;
    const days = ageDays(row, now);
    return days === null ? true : days >= filters.olderThanDays;
  });
}

export function sortSnapshots(files: readonly SnapshotRow[], sort: SnapshotSort): SnapshotRow[] {
  const indexed = files.map((row, index) => ({ row, index }));
  const time = (row: SnapshotRow): number => {
    const at = Date.parse(row.mtime);
    return Number.isFinite(at) ? at : 0;
  };
  indexed.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return time(a.row) - time(b.row) || a.index - b.index;
      case 'largest':
        return b.row.size - a.row.size || a.index - b.index;
      case 'smallest':
        return a.row.size - b.row.size || a.index - b.index;
      case 'name':
        return a.row.name.localeCompare(b.row.name) || a.index - b.index;
      case 'newest':
      default:
        return time(b.row) - time(a.row) || a.index - b.index;
    }
  });
  return indexed.map((entry) => entry.row);
}
