import Sheet from '@/components/sheet';
import { useLocale } from '@/hooks/use-locale';
import type { Messages } from '@/i18n/messages';
import type { TorrentInfo } from '@/types';
import { formatBytes, formatSpeed } from '@/utils/format-bytes';

export type StreamSource = 'connected' | 'waiting' | 'http';

type Row = { label: string; value: string };

function rowsFor(
  source: StreamSource,
  torrent: TorrentInfo | undefined,
  t: Messages,
): Row[] {
  if (source === 'http') return [];

  return [
    { label: t.stream.peers, value: `${torrent?.peers ?? 0}` },
    { label: t.stream.down, value: formatSpeed(torrent?.downloadSpeed) },
    { label: t.stream.up, value: formatSpeed(torrent?.uploadSpeed) },
    { label: t.stream.downloaded, value: formatBytes(torrent?.downloaded) },
    { label: t.stream.progress, value: `${((torrent?.progress ?? 0) * 100).toFixed(1)}%` },
    { label: t.stream.files, value: `${torrent?.files.length ?? 0}` },
  ];
}

/**
 * The v1 readout. Every number comes from the running torrent; an HTTP-only
 * reciter says so instead of showing a column of zeroes.
 */
export default function StreamSheet({
  open,
  onClose,
  source,
  torrent,
}: {
  open: boolean;
  onClose: () => void;
  source: StreamSource;
  torrent: TorrentInfo | undefined;
}) {
  const { t } = useLocale();
  const badge = source === 'http' ? t.source.label : t.source.p2p;

  return (
    <Sheet title={t.stream.title} open={open} onClose={onClose} size="auto">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink">
            {badge}
          </span>
          <span className="text-[12px] text-muted">
            {source === 'http' ? t.source.fromHost : t.source.fromPeers}
          </span>
        </div>

        {source === 'http' ? (
          <div className="space-y-1 text-[13px] leading-relaxed text-muted">
            <p className="text-[15px] font-semibold text-ink">{t.source.label}</p>
            <p>{t.stream.httpNote}</p>
          </div>
        ) : (
          <dl className="space-y-2">
            {rowsFor(source, torrent, t).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-6">
                <dt className="text-[13px] text-muted">{row.label}</dt>
                <dd className="tnum text-[13px] text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {source === 'waiting' && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{t.stream.waitingNote}</p>
        )}
      </div>
    </Sheet>
  );
}
