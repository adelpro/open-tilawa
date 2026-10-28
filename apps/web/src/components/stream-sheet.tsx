import { useEffect, useState } from 'react';

import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import StreamSourceIcon from '@/components/stream-source-icon';
import { useLocale } from '@/hooks/use-locale';
import type { Messages } from '@/i18n/messages';
import type { TorrentInfo } from '@/types';
import { formatBytes, formatSpeed } from '@/utils/format-bytes';
import type { StreamSource } from '@/utils/stream-source';
import { probeMedia } from '@/utils/webseed';

type Row = { label: string; value: string; icon: 'users' | 'download' | 'upload' | 'activity' | 'file' };

function rowsFor(torrent: TorrentInfo | undefined, t: Messages): Row[] {
  return [
    { label: t.stream.peers, value: `${torrent?.peers ?? 0}`, icon: 'users' },
    { label: t.stream.down, value: formatSpeed(torrent?.downloadSpeed), icon: 'download' },
    { label: t.stream.up, value: formatSpeed(torrent?.uploadSpeed), icon: 'upload' },
    { label: t.stream.downloaded, value: formatBytes(torrent?.downloaded), icon: 'download' },
    { label: t.stream.progress, value: `${((torrent?.progress ?? 0) * 100).toFixed(1)}%`, icon: 'activity' },
    { label: t.stream.files, value: `${torrent?.files.length ?? 0}`, icon: 'file' },
  ];
}

const FALLBACK_LABEL = {
  checking: (t: Messages) => t.stream.fallbackChecking,
  available: (t: Messages) => t.stream.fallbackAvailable,
  missing: (t: Messages) => t.stream.fallbackMissing,
  unknown: () => '—',
} as const;

/**
 * The stream readout. Every number comes from the running torrent; the last row
 * answers the only question a listener has when nothing plays — is there another
 * source for this surah? One HEAD against our own origin, cached per file.
 */
export default function StreamSheet({
  open,
  onClose,
  source,
  torrent,
  surahId,
}: {
  open: boolean;
  onClose: () => void;
  source: StreamSource;
  torrent: TorrentInfo | undefined;
  surahId: number;
}) {
  const { t } = useLocale();
  const [fallback, setFallback] = useState<'checking' | 'available' | 'missing' | 'unknown'>(
    'checking',
  );

  const folder = torrent?.name ?? '';

  useEffect(() => {
    // Without metadata there is no folder to ask about: the row says so instead
    // of sitting on "checking" for a torrent that never arrived.
    if (!folder) {
      setFallback('unknown');
      return;
    }
    if (!open || !surahId) {
      setFallback('checking');
      return;
    }
    let live = true;
    setFallback('checking');
    void probeMedia(window.location.origin, folder, surahId).then((available) => {
      if (live) setFallback(available ? 'available' : 'missing');
    });
    return () => {
      live = false;
    };
  }, [open, folder, surahId]);

  const sourceLabel =
    source === 'mixed'
      ? t.source.mixed
      : source === 'webseed'
        ? t.source.webseed
        : source === 'connected'
          ? t.source.connected
          : t.source.waiting;

  return (
    <Sheet title={t.stream.title} open={open} onClose={onClose} size="auto">
      <div className="px-5 py-4">
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2 text-[13px] text-muted">
              <StreamSourceIcon source={source} className="h-4 w-4" />
              {t.stream.source}
            </dt>
            <dd className="text-[13px] font-medium text-ink">{sourceLabel}</dd>
          </div>
          {rowsFor(torrent, t).map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-6">
              <dt className="flex items-center gap-2 text-[13px] text-muted">
                <Icon name={row.icon as any} className="h-4 w-4" />
                {row.label}
              </dt>
              <dd className="tnum text-[13px] text-ink">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2 text-[13px] text-muted">
              <Icon name="link" className="h-4 w-4" />
              {t.stream.fallback}
            </dt>
            <dd className="text-[13px] text-ink">{FALLBACK_LABEL[fallback](t)}</dd>
          </div>
        </dl>

        {source === 'waiting' && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{t.stream.waitingNote}</p>
        )}
      </div>
    </Sheet>
  );
}
