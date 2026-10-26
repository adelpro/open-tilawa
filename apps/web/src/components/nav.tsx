import { useAtomValue } from 'jotai';
import { Link, useLocation } from 'react-router-dom';

import { Icon, type IconName } from '@/components/icons';
import { APP_VERSION } from '@/constants/version';
import { loadState } from '@/hooks/use-persistence';
import { useTheme } from '@/hooks/use-theme';
import { selectedReciterAtom } from '@/jotai/atom';
import { cn } from '@/utils/cn';

type Tab = {
  label: string;
  to: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

/**
 * Three destinations, no more. The library, whatever is in the room, and the
 * one page that explains the project.
 */
function useTabs(): Tab[] {
  const state = loadState();
  const stored = state.reciterId ? `/reciter/${state.reciterId}` : '/';
  const resume = state.reciterId ? state.positions[String(state.reciterId)] : undefined;

  return [
    { label: 'المكتبة', to: '/', icon: 'library', match: (p) => p === '/' },
    {
      label: 'التشغيل',
      to: resume ? `${stored}/${resume.surahId}` : stored,
      icon: 'play',
      match: (p) => p.startsWith('/reciter'),
    },
    { label: 'حول', to: '/about', icon: 'info', match: (p) => p.startsWith('/about') },
  ];
}

export function BottomTabs() {
  const { pathname } = useLocation();
  const tabs = useTabs();

  return (
    <nav
      aria-label="التنقل"
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-divider bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="flex h-full items-stretch">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.label} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[10px]',
                  active ? 'text-ink' : 'text-ink-tertiary',
                )}
              >
                <Icon name={tab.icon} size={20} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="block px-1" aria-label="تلاوة — الصفحة الرئيسية">
      <span className="font-display text-[30px] leading-none">تلاوة</span>
      <span className="badge-tech mt-1.5 block text-ink-tertiary">Open Tilawa</span>
    </Link>
  );
}

export function SideNav() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const reciter = useAtomValue(selectedReciterAtom);
  const tabs = useTabs();

  return (
    <nav
      aria-label="التنقل"
      className="hidden h-dvh flex-col border-e border-divider px-5 py-7 lg:flex"
    >
      <Brand />

      <ul className="mt-10 space-y-0.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.label}>
              <Link
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-[14px] transition-colors',
                  active ? 'bg-surface-2/60 font-semibold text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                <Icon name={tab.icon} size={18} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {reciter && (
        <div className="mt-8 border-t border-divider pt-4">
          <p className="px-2 text-[10px] text-ink-tertiary">القارئ الحالي</p>
          <Link
            to={`/reciter/${reciter.id}`}
            className="mt-1 block truncate px-2 text-[13px] text-ink-secondary hover:text-ink"
          >
            {reciter.name}
          </Link>
        </div>
      )}

      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 px-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          {theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
        </button>
        <p className="tnum px-2 text-[10px] text-ink-tertiary">v{APP_VERSION}</p>
      </div>
    </nav>
  );
}
