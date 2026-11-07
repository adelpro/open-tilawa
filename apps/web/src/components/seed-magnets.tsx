import CopyCode from '@/components/copy-code';
import { useLocale } from '@/hooks/use-locale';
import { useReciters } from '@/hooks/use-reciters';
import { formatBytes } from '@/utils/format-bytes';
import { riwayaLabel } from '@/utils/riwaya';

/**
 * Every published reciter, as a link a person can take away.
 *
 * The magnet is rendered exactly as the catalogue returns it: no web seed is
 * appended, nothing is re-encoded. It is the same string the player announces
 * with, so whoever copies it joins the same swarm — and a list built into this
 * file would rot the first time a reciter is added.
 */
export default function SeedMagnets() {
  const { reciters, error, loading, retry } = useReciters();
  const { t } = useLocale();
  const copy = t.seedPage.magnets;
  const total = reciters.reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);

  return (
    <section id="magnets" className="seed-section mt-14 scroll-mt-8">
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

      <ul className="mt-6 space-y-6">
        {reciters.map((reciter) => (
          <li key={reciter.id}>
            <h3 className="text-[1rem] font-semibold leading-snug text-ink">{reciter.name}</h3>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              {riwayaLabel(reciter.riwaya)} · {formatBytes(reciter.sizeBytes)} ·{' '}
              {reciter.complet ? t.sheets.complete : t.sheets.partial}
            </p>
            <CopyCode
              value={reciter.magnet}
              title={copy.link}
              label={t.seedPage.copy}
              copiedLabel={t.seedPage.copied}
              failedLabel={t.seedPage.copyFailed}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
