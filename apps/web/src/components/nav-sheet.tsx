import { Gear, Headphones, Info, ShieldCheck } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import type { Route } from '@/hooks/use-hash-route';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

/**
 * The menu is navigation, nothing else: every row leads to a page. Settings
 * moved to `/settings` — a sheet that both navigates and hosts controls made
 * the two indistinguishable.
 */
export default function NavSheet({
  open,
  route,
  onClose,
  onNavigate,
}: {
  open: boolean;
  route: Route;
  onClose: () => void;
  onNavigate: (route: Route) => void;
}) {
  const { t } = useLocale();

  const items: { route: Route; label: string; icon: ReactNode }[] = [
    { route: '/', label: t.routes.listen, icon: <Headphones size={18} /> },
    { route: '/settings', label: t.routes.settings, icon: <Gear size={18} /> },
    { route: '/about', label: t.routes.about, icon: <Info size={18} /> },
    { route: '/privacy', label: t.routes.privacy, icon: <ShieldCheck size={18} /> },
  ];

  return (
    <Sheet title={t.menu.open} open={open} onClose={onClose} size="auto">
      <div className="pb-3">
        {items.map((item) => {
          const current = item.route === route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex h-12 w-full items-center gap-3 px-4 text-start text-[15px] text-ink transition-colors hover:bg-line active:bg-line',
                current && 'font-semibold',
              )}
            >
              <span className={cn('shrink-0', current ? 'text-ink' : 'text-muted')}>{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <Icon name="chevron-left" className="h-4 w-4 text-muted rtl:rotate-0 ltr:rotate-180" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
