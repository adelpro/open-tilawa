import Icon from '@/components/icons';
import Link from '@/components/link';
import { useLocale } from '@/hooks/use-locale';
import { useReciters } from '@/hooks/use-reciters';
import { surahSlug } from '@/routes';
import type { Reciter } from '@/types';
import { riwayaLabel } from '@/utils/riwaya';
import { surahName } from '@/utils/surah-name';

/**
 * One surah, every reciter who has it.
 *
 * This is the page a search for "سورة الكهف" should land on, and it exists because the
 * alternative — one page per reciter per surah — is 1,368 near-identical pages, which is
 * a doorway set rather than a site. The player keeps `/listen/...`; this page is the way
 * in, and each row is a real link to a real recitation, so the hub is worth indexing on
 * its own.
 *
 * The prerender writes the same list into the HTML, so the rows are readable before the
 * app runs.
 */
export default function SurahPage({ id }: { id: number }) {
  const { t, locale } = useLocale();
  const { reciters, error } = useReciters();
  const copy = t.surahPage;
  const name = surahName(id, locale);

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <h1 className="text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">
          {copy.title(name)}
        </h1>

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{copy.lede(name)}</p>

        {error && reciters.length === 0 ? (
          <p className="mt-8 text-[1rem] leading-relaxed text-muted">{t.sheets.recitersError}</p>
        ) : (
          <ul className="mt-8 divide-y divide-line/60 border-y border-line/60">
            {reciters.map((reciter: Reciter) => {
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] text-ink">{reciter.name}</span>
                    <span className="mt-1 block text-[0.75rem] text-muted">
                      {reciter.complet ? t.sheets.complete : t.sheets.partial}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-line px-2 py-1 text-[0.75rem] text-ink">
                    {riwayaLabel(reciter.riwaya)}
                  </span>
                  <Icon name="forward" size={16} className="icon-dir text-muted" />
                </>
              );
              // No slug, no URL: the catalogue assigns it, and this app never invents one.
              return (
                <li key={reciter.id}>
                  {reciter.slug ? (
                    <Link
                      to={{
                        name: 'listen',
                        release: reciter.slug,
                        surah: id,
                        surahName: surahSlug(id),
                      }}
                      className="press flex min-h-14 w-full items-center gap-3 py-3 text-start transition-colors hover:text-ink"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 w-full items-center gap-3 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* The one crawl path between these pages: neighbours, not a sitemap link. */}
        <nav className="mt-10 flex items-center justify-between gap-4 text-[0.875rem]">
          {id > 1 ? (
            <Link
              to={{ name: 'surah', surah: id - 1, surahName: surahSlug(id - 1) }}
              className="inline-flex min-h-11 items-center gap-2 text-muted transition-colors hover:text-ink"
            >
              <Icon name="back" size={16} className="icon-dir" />
              {copy.previous}
            </Link>
          ) : (
            <span />
          )}
          {id < 114 ? (
            <Link
              to={{ name: 'surah', surah: id + 1, surahName: surahSlug(id + 1) }}
              className="inline-flex min-h-11 items-center gap-2 text-muted transition-colors hover:text-ink"
            >
              {copy.next}
              <Icon name="forward" size={16} className="icon-dir" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
