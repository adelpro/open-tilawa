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
  onOpenAccount,
}: {
  open: boolean;
  route: Route;
  onClose: () => void;
  onNavigate: (route: Route) => void;
  onOpenAccount?: () => void;
}) {
  const { t } = useLocale();

  const items: { route?: Route; label: string; icon: ReactNode; action?: () => void }[] = [
    { route: '/', label: t.routes.listen, icon: <Icon name="house" /> },
    { route: '/settings', label: t.routes.settings, icon: <Icon name="gear" /> },
    { label: t.account.title, icon: <Icon name="user" />, action: onOpenAccount },
    { route: '/about', label: t.routes.about, icon: <Icon name="info" /> },
    { route: '/privacy', label: t.routes.privacy, icon: <Icon name="shield" /> },
  ];

  return (
    <Sheet title={t.menu.open} open={open} onClose={onClose} size="auto">
      <div className="pb-3">
        {items.map((item, idx) => {
          const current = item.route ? item.route === route : false;
          return (
            <button
              key={item.route || item.label || idx}
              type="button"
              onClick={() => {
                if (item.action) {
                  item.action();
                  onClose();
                  return;
                }
                if (item.route) {
                  onNavigate(item.route);
                }
              }}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'press flex min-h-12 w-full items-center gap-2 px-4 text-start text-[1rem] text-ink transition-colors hover:bg-line',
                current && 'font-semibold',
              )}
            >
              <span className={cn('shrink-0', current ? 'text-ink' : 'text-muted')}>{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <Icon name="forward" className="text-muted" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
