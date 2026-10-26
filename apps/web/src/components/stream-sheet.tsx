import Sheet from '@/components/sheet';
import type { TorrentInfo } from '@/types';
import { formatBytes, formatSpeed } from '@/utils/format-bytes';

export type StreamSource = 'connected' | 'waiting' | 'http';

const SOURCE_LABEL: Record<StreamSource, string> = {
  connected: 'P2P',
  waiting: 'P2P',
  http: 'HTTP',
};

type Row = { label: string; value: string };

function rowsFor(source: StreamSource, torrent: TorrentInfo | undefined): Row[] {
  if (source === 'http') return [];

  return [
    { label: 'الأقران', value: `${torrent?.peers ?? 0}` },
    { label: 'التنزيل', value: formatSpeed(torrent?.downloadSpeed) },
    { label: 'الرفع', value: formatSpeed(torrent?.uploadSpeed) },
    { label: 'المُنزَّل', value: formatBytes(torrent?.downloaded) },
    { label: 'التقدّم', value: `${((torrent?.progress ?? 0) * 100).toFixed(1)}%` },
    { label: 'الملفات', value: `${torrent?.files.length ?? 0}` },
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
  return (
    <Sheet title="تفاصيل البث" open={open} onClose={onClose} size="auto">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink">
            {SOURCE_LABEL[source]}
          </span>
          <span className="text-[12px] text-muted">
            {source === 'http' ? 'من خادم القارئ' : 'من الشبكة الندّية'}
          </span>
        </div>

        {source === 'http' ? (
          <div className="space-y-1 text-[13px] leading-relaxed text-muted">
            <p className="text-[15px] font-semibold text-ink">HTTP</p>
            <p>يُشغَّل من خادم القارئ مباشرة، فلا يحتاج إلى أقران.</p>
          </div>
        ) : (
          <dl className="space-y-2">
            {rowsFor(source, torrent).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-6">
                <dt className="text-[13px] text-muted">{row.label}</dt>
                <dd className="tnum text-[13px] text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {source === 'waiting' && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            لم يتصل أي قارئ بعد. التشغيل يبدأ عندما يظهر أوّل قرين.
          </p>
        )}
      </div>
    </Sheet>
  );
}
