import { useSetAtom } from 'jotai';

import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import { useReciters } from '@/hooks/use-reciters';
import { navigate } from '@/hooks/use-route';
import { selectedReciterAtom } from '@/jotai/atom';
import { riwayaLabel } from '@/utils/riwaya';

/**
 * The roster as a page, for the listener who arrives without a reciter in mind.
 *
 * `/reciters` is the one hub with a screen behind it: the catalogue is the whole
 * roster, in its order, and each row is an action — pick this release and go back to
 * the player. The panel behind the title chevrons stays the quick way to switch while
 * listening; this is the way to browse before anything is playing.
 *
 * The prerender writes the same list into the page's HTML, so the names are readable
 * without running the app and the page is worth a sitemap row.
 */
export default function RecitersPage() {
  const { t } = useLocale();
  const { reciters, error } = useReciters();
  const setSelectedReciter = useSetAtom(selectedReciterAtom);
  const copy = t.recitersPage;

  const pick = (reciter: (typeof reciters)[number]): void => {
    setSelectedReciter(reciter);
    navigate({ name: 'home' });
  };

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <h1 className="text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">
          {copy.title}
        </h1>

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{copy.lede}</p>

        {error && reciters.length === 0 ? (
          <p className="mt-8 text-[1rem] leading-relaxed text-muted">{t.sheets.recitersError}</p>
        ) : (
          <ul className="mt-8 divide-y divide-line/60 border-y border-line/60">
            {reciters.map((reciter) => (
              <li key={reciter.id}>
                <button
                  type="button"
                  onClick={() => pick(reciter)}
                  className="press flex min-h-14 w-full items-center gap-3 py-3 text-start transition-colors hover:text-ink"
                >
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
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
