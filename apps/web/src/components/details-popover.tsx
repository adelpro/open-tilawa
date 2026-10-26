import { useEffect, useRef, type RefObject } from 'react';

import type { TorrentInfo } from '@/types';
import { formatBytes, formatSpeed } from '@/utils/format-bytes';

export type StreamSource = 'connected' | 'waiting' | 'http';

type Row = { label: string; value: string };

const SOURCE_LABEL: Record<StreamSource, string> = {
  connected: 'P2P',
  waiting: 'P2P',
  http: 'HTTP',
};

function rowsFor(source: StreamSource, torrent: TorrentInfo | undefined): Row[] {
  if (source === 'http') return [];

  return [
    { label: 'المصدر', value: SOURCE_LABEL[source] },
    { label: 'الأقران', value: `${torrent?.peers ?? 0}` },
    { label: 'التنزيل', value: formatSpeed(torrent?.downloadSpeed) },
    { label: 'الرفع', value: formatSpeed(torrent?.uploadSpeed) },
    { label: 'المُنزَّل', value: formatBytes(torrent?.downloaded) },
    { label: 'التقدّم', value: `${((torrent?.progress ?? 0) * 100).toFixed(1)}%` },
    { label: 'الملفات', value: `${torrent?.files.length ?? 0}` },
  ];
}

/**
 * The v1 readout, kept honest: every number here comes from the running
 * torrent, and an HTTP-only reciter says so instead of showing zeroes.
 */
export default function DetailsPopover({
  source,
  torrent,
  onClose,
  returnFocusRef,
}: {
  source: StreamSource;
  torrent: TorrentInfo | undefined;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      returnFocusRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (returnFocusRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose, returnFocusRef]);

  const rows = rowsFor(source, torrent);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="تفاصيل البث"
      className="absolute bottom-full end-2 z-20 mb-2 w-[min(320px,calc(100vw-24px))] rounded-xl border border-line bg-canvas p-4"
    >
      {source === 'http' ? (
        <div className="space-y-1 text-xs text-muted">
          <p className="text-[13px] font-semibold text-ink">HTTP</p>
          <p>يُشغَّل من خادم القارئ مباشرة، فلا يحتاج إلى أقران.</p>
        </div>
      ) : (
        <dl className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-6">
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className="tnum text-xs text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {source === 'waiting' && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          لم يتصل أي قارئ بعد. التشغيل يبدأ عندما يظهر أوّل قرين.
        </p>
      )}
    </div>
  );
}
