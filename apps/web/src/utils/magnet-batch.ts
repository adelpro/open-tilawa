/**
 * The clipboard payload for "copy all": one magnet per line.
 *
 * qBittorrent's Add Torrent Link window parses one link per line, so a blank
 * entry or a stray trailing newline becomes an error row in the dialog. Trimming
 * and dropping empties is the whole job.
 */
export function magnetBatch(magnets: string[]): string {
  return magnets
    .map((magnet) => magnet.trim())
    .filter(Boolean)
    .join('\n');
}
