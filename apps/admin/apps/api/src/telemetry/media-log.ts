/**
 * What the edge knows exactly, and the client can only estimate.
 *
 * nginx logs one line per `/media` response with the bytes it actually sent, so the HTTP
 * side of the traffic figure needs no client telemetry at all. The torrent side has no such
 * record: it is assembled from `torrent.downloaded` deltas while a surah plays, so it stays
 * approximate and the console says so.
 *
 * A 404 is not traffic. Neither is a HEAD, which asks for the row and returns none of it.
 */
export type MediaLine = { reciter: string; surah: number; bytes: number };

/**
 * The day a log file covers, from its name (`media-<host>-<YYYY-MM-DD>.log`).
 *
 * nginx writes the path with variables in it, so the file itself is the only
 * clock: one line carries no date at all, by design — the format is deliberately
 * narrower than `combined` so the log is small and holds no address.
 */
export function dayFromFile(name: string): string | null {
  const match = /^media-.+-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
  return match ? match[1] : null;
}

const MEDIA = /"GET \/media\/([^/]+)\/(\d{3})\.mp3[^"]*" (\d{3}) (\d+)/;

export function parseMediaLines(lines: string[]): MediaLine[] {
  const out: MediaLine[] = [];
  for (const line of lines) {
    const match = MEDIA.exec(line);
    if (!match) continue;
    const [, reciter, file, status, bytes] = match;
    if (status !== '200' && status !== '206') continue;
    const surah = Number(file);
    const size = Number(bytes);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) continue;
    if (!Number.isFinite(size) || size <= 0) continue;
    out.push({ reciter, surah, bytes: size });
  }
  return out;
}

export function totalBySurah(lines: string[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of parseMediaLines(lines)) {
    const key = `${line.reciter}/${line.surah}`;
    totals.set(key, (totals.get(key) ?? 0) + line.bytes);
  }
  return totals;
}
