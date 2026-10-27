import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

/**
 * The mark sits at the reading edge (right), the menu at the other. The button
 * is a sandwich that becomes an X: on a phone that is the only navigation the
 * page has, and a static three-line glyph that opens a list reads as a menu
 * without a label.
 */
export default function TopBar({
  menuOpen,
  onToggleMenu,
  onOpenSurahs,
  onOpenReciters,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
}) {
  const { t } = useLocale();

  return (
    <header className="top-bar flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
      <a href="#/" aria-label={`${t.brand} — ${t.routes.listen}`} className="flex items-center gap-2">
        <img src="/images/icon.png" alt="" className="brand-mark h-6 w-auto" />
        <span className="tnum text-[10px] leading-none text-muted">{APP_VERSION}</span>
      </a>

      {/* Desktop navigation: three words, no sandwich. The two lists are the
          same panels the phone opens, just reachable from here as well. */}
      <nav className="hidden items-center gap-5 text-[13px] text-muted lg:flex" aria-label={t.brand}>
        <button type="button" onClick={onOpenReciters} className="transition-colors hover:text-ink">
          {t.sheets.reciters}
        </button>
        <button type="button" onClick={onOpenSurahs} className="transition-colors hover:text-ink">
          {t.sheets.surahs}
        </button>
        <a href="#/about" className="transition-colors hover:text-ink">
          {t.routes.about}
        </a>
        <a href="#/privacy" className="transition-colors hover:text-ink">
          {t.routes.privacy}
        </a>
      </nav>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-label={menuOpen ? t.menu.close : t.menu.open}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-line active:bg-line lg:hidden"
      >
        <span className="flex w-5 flex-col items-stretch gap-[5px]" aria-hidden="true">
          <span
            className={cn(
              'h-[1.5px] w-5 rounded-full bg-current transition-transform duration-200',
              menuOpen && 'translate-y-[6.5px] rotate-45',
            )}
          />
          <span
            className={cn(
              'h-[1.5px] w-5 rounded-full bg-current transition-opacity duration-150',
              menuOpen && 'opacity-0',
            )}
          />
          <span
            className={cn(
              'h-[1.5px] w-5 rounded-full bg-current transition-transform duration-200',
              menuOpen && '-translate-y-[6.5px] -rotate-45',
            )}
          />
        </span>
      </button>
    </header>
  );
}
