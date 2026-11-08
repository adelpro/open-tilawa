import { useEffect, useRef, useState } from 'react';

import CopyCode from '@/components/copy-code';
import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import { useReciters } from '@/hooks/use-reciters';
import { formatBytes } from '@/utils/format-bytes';
import { magnetBatch } from '@/utils/magnet-batch';
import { reciterName } from '@/utils/reciter-name';
import { riwayaLabel } from '@/utils/riwaya';
import { torrentLinkHref } from '@/utils/torrent-link';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Every published reciter, as a link a person can take away.
 *
 * The magnet is rendered exactly as the catalogue returns it: no web seed is
 * appended, nothing is re-encoded. It is the same string the player announces
 * with, so whoever copies it joins the same swarm — and a list built into this
 * file would rot the first time a reciter is added.
 *
 * Rows fold: twelve magnets is six screens of text, and most visitors want the
 * whole roster at once, which is what the button above the list is for.
 */
export default function SeedMagnets() {
  const { reciters, error, loading, retry } = useReciters();
  const { t, locale } = useLocale();
  const copy = t.seedPage.magnets;
  const total = reciters.reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);

  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copyAll = async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(magnetBatch(reciters.map((reciter) => reciter.magnet)));
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2400);
  };

  return (
    <section id="magnets" className="seed-section mt-14 scroll-mt-24">
      <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.title}</h2>
      <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.lede}</p>
      {total > 0 ? (
        <p className="mt-3 text-[0.9375rem] text-muted">
          {copy.totalLabel}: {formatBytes(total)}
        </p>
      ) : null}

      {loading ? <p className="mt-4 text-[0.9375rem] text-muted">{copy.loading}</p> : null}

      {error && reciters.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink">
          {copy.failed}{' '}
          <button type="button" onClick={retry} className="press underline">
            {copy.retry}
          </button>
        </p>
      ) : null}

      {!loading && !error && reciters.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] text-muted">{copy.empty}</p>
      ) : null}

      {reciters.length > 0 ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void copyAll()}
            className={
              state === 'copied'
                ? 'press inline-flex min-h-11 items-center gap-2 bg-line px-4 text-[0.9375rem] font-semibold text-ink'
                : 'press inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-[0.9375rem] font-semibold text-invert'
            }
          >
            {state === 'copied' ? <Icon name="check" size={16} /> : null}
            {state === 'copied' ? copy.copiedAll : state === 'failed' ? copy.copyAllFailed : copy.copyAll}
          </button>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{copy.copyAllHint}</p>
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-line/60 border-y border-line/60">
        {reciters.map((reciter) => {
          // Only a stored `magnet:?…` becomes a link; see torrentLinkHref.
          const href = torrentLinkHref(reciter.magnet);
          const name = reciterName(reciter, locale);
          return (
            <li key={reciter.id}>
              <details>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] text-ink">{name}</span>
                    <span className="mt-1 block text-[0.75rem] text-muted">
                      {riwayaLabel(reciter.riwaya)} · {formatBytes(reciter.sizeBytes)} ·{' '}
                      {reciter.complet ? t.sheets.complete : t.sheets.partial}
                    </span>
                  </span>
                  <Icon
                    name="forward"
                    size={16}
                    className="icon-dir shrink-0 text-muted transition-transform [details[open]_&]:rotate-90"
                  />
                </summary>
                <CopyCode
                  value={reciter.magnet}
                  title={copy.link}
                  label={t.seedPage.copy}
                  copiedLabel={t.seedPage.copied}
                  failedLabel={t.seedPage.copyFailed}
                  open={href ? { href, label: copy.open, name } : undefined}
                />
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
