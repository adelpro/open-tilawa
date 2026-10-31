import { useEffect } from 'react';

import Icon from '@/components/icons';
import Link from '@/components/link';
import { SURAHS } from '@/constants/surah';
import { useLocale } from '@/hooks/use-locale';
import { useReciters } from '@/hooks/use-reciters';
import { surahSlug } from '@/routes';
import { riwayaLabel } from '@/utils/riwaya';
import { surahName } from '@/utils/surah-name';

/**
 * One reciter, every surah.
 *
 * This is the site's unit of grouping: the catalogue is organised by recitation, so the
 * page that answers "ماهر المعيقلي" is a list of the 114 chapters he recites, each row a
 * link into the player. The roster is the hub; this is the shelf.
 *
 * The prerender writes the same list into the HTML, so the rows are readable before the
 * app runs — which is the whole reason the page is worth a sitemap row.
 */
export default function ReciterPage({ slug }: { slug: string }) {
  const { t, locale } = useLocale();
  const { reciters, error } = useReciters();
  const copy = t.reciterPage;

  const reciter = reciters.find((candidate) => candidate.slug === slug);
  const name = reciter ? reciter.name : slug;

  /**
   * The tab names the reciter, and the player's own title logic steps aside for this
   * route — the name lives in the catalogue, not in the route.
   */
  useEffect(() => {
    if (reciter) document.title = `${name} — Tilawah`;
  }, [reciter, name]);

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <Link
          to={{ name: 'reciters' }}
          className="inline-flex min-h-11 items-center gap-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
        >
          <Icon name="back" className="icon-dir text-muted" />
          {t.routes.reciters}
        </Link>

        <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">
          {name}
        </h1>

        {reciter ? (
          <p className="mt-2 text-[0.875rem] text-muted">
            {riwayaLabel(reciter.riwaya)} · {reciter.complet ? t.sheets.complete : t.sheets.partial}
          </p>
        ) : null}

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{copy.lede(name)}</p>

        {error && reciters.length === 0 ? (
          <p className="mt-8 text-[1rem] leading-relaxed text-muted">{t.sheets.recitersError}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-4 border-t border-line/60 sm:grid-cols-3">
            {SURAHS.map((surah) => (
              <li key={surah.id} className="border-b border-line/60">
                {reciter?.slug ? (
                  <Link
                    to={{
                      name: 'listen',
                      release: reciter.slug,
                      surah: surah.id,
                      surahName: surahSlug(surah.id),
                    }}
                    className="press flex min-h-11 items-center gap-2 py-2 text-[0.9375rem] text-ink transition-colors hover:text-muted"
                  >
                    <span className="tnum w-6 shrink-0 text-[0.75rem] text-muted">{surah.id}</span>
                    <span className="truncate">{surahName(surah.id, locale)}</span>
                  </Link>
                ) : (
                  <span className="flex min-h-11 items-center gap-2 py-2 text-[0.9375rem] text-muted">
                    <span className="tnum w-6 shrink-0 text-[0.75rem]">{surah.id}</span>
                    <span className="truncate">{surahName(surah.id, locale)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
