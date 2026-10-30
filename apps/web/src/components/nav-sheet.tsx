import type { ReactNode } from 'react';

import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import type { Parsed, RouteName } from '@/routes';
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
  route: Parsed;
  onClose: () => void;
  onNavigate: (route: Parsed) => void;
  onOpenAccount?: () => void;
}) {
  const { t } = useLocale();

  const items: { name?: RouteName; label: string; icon: ReactNode; action?: () => void }[] = [
    { name: 'home', label: t.routes.listen, icon: <Icon name="house" /> },
    { name: 'settings', label: t.routes.settings, icon: <Icon name="gear" /> },
    { label: t.account.title, icon: <Icon name="user" />, action: onOpenAccount },
    { name: 'about', label: t.routes.about, icon: <Icon name="info" /> },
    { name: 'privacy', label: t.routes.privacy, icon: <Icon name="shield" /> },
  ];

  return (
    <Sheet title={t.menu.open} open={open} onClose={onClose} size="auto">
      <div className="pb-3">
        {items.map((item, idx) => {
          const current = item.name ? item.name === route.name : false;
          return (
            <button
              key={item.name || item.label || idx}
              type="button"
              onClick={() => {
                if (item.action) {
                  item.action();
                  onClose();
                  return;
                }
                if (item.name) {
                  onNavigate({ name: item.name } as Parsed);
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
