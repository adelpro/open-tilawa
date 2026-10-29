import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';
import Icon from '@/components/icons';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';

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
  onOpenKeys,
  onOpenAccount,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
  onOpenKeys: () => void;
  onOpenAccount?: () => void;
}) {
  const { t } = useLocale();
  const isListen = typeof location !== 'undefined' && location.hash === '#/';
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <header className="top-bar flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
      {/* The wordmark is the link's name, so the version sits outside it: an
          aria-label that left the visible "1.8.3" out failed WCAG 2.5.3. */}
      <a href="#/" className="flex items-center gap-2">
        <img src="/images/icon.png" alt={t.brand} className="brand-mark h-6 w-auto" />
        <span aria-hidden="true" className="tnum text-[0.75rem] leading-none text-muted">
          {APP_VERSION}
        </span>
      </a>

      {/* Desktop navigation: three words, no sandwich. The two lists are the
          same panels the phone opens, just reachable from here as well. */}
      <nav className="hidden items-center gap-1 text-[0.875rem] text-muted lg:flex" aria-label={t.brand}>
        <a
          href="#/"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-line/50 hover:text-ink',
            isListen && 'text-ink',
          )}
        >
          <Icon name="house" weight={isListen ? 'fill' : 'regular'} />
          {t.routes.listen}
        </a>
        <button
          type="button"
          onClick={onOpenReciters}
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-line/50 hover:text-ink"
        >
          <Icon name="mic" />
          {t.sheets.reciters}
        </button>
        <button
          type="button"
          onClick={onOpenSurahs}
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-line/50 hover:text-ink"
        >
          <Icon name="book" />
          {t.sheets.surahs}
        </button>
        {onOpenAccount && (
          <button
            type="button"
            onClick={onOpenAccount}
            className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-line/50 hover:text-ink"
          >
            <Icon name="user" />
            {t.account.title}
          </button>
        )}
        <a
          href="#/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-line/50 hover:text-ink"
        >
          <Icon name="gear" />
          {t.routes.settings}
        </a>
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={t.menu.more}
            title={t.menu.more}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-line/50 hover:text-ink',
              moreOpen && 'bg-line/50 text-ink',
            )}
          >
            <Icon name="more" size={20} />
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute end-0 top-full mt-1 w-40 overflow-hidden rounded-lg border border-line bg-canvas shadow-lg"
            >
              <a
                href="#/about"
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[0.875rem] text-ink transition-colors hover:bg-line/50"
              >
                <Icon name="info" />
                {t.routes.about}
              </a>
              <a
                href="#/privacy"
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[0.875rem] text-ink transition-colors hover:bg-line/50"
              >
                <Icon name="shield" />
                {t.routes.privacy}
              </a>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenKeys}
          aria-label={t.keys.title}
          title={t.keys.title}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-line/50 hover:text-ink"
        >
          <Icon name="key" />
        </button>
      </nav>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-label={menuOpen ? t.menu.close : t.menu.open}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        className="press -me-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-line active:bg-line lg:hidden"
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
