import { Gear, Headphones, Info, ShieldCheck, User } from '@phosphor-icons/react';
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
    { route: '/', label: t.routes.listen, icon: <Headphones size={18} /> },
    { route: '/settings', label: t.routes.settings, icon: <Gear size={18} /> },
    { label: t.account.title, icon: <User size={18} />, action: onOpenAccount },
    { route: '/about', label: t.routes.about, icon: <Info size={18} /> },
    { route: '/privacy', label: t.routes.privacy, icon: <ShieldCheck size={18} /> },
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
                'press flex h-12 w-full items-center gap-3 px-4 text-start text-[15px] text-ink transition-colors hover:bg-line',
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
