import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import type { Route } from '@/hooks/use-hash-route';
import { cn } from '@/utils/cn';

const ITEMS: { route: Route; label: string }[] = [
  { route: '/', label: 'الاستماع' },
  { route: '/about', label: 'عن تلاوة' },
  { route: '/privacy', label: 'الخصوصية' },
];

/** The list of routes. One tap, no nested menus. */
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
  return (
    <Sheet title="القائمة" open={open} onClose={onClose} size="auto">
      <div className="pb-3">
        {ITEMS.map((item) => {
          const current = item.route === route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex h-14 w-full items-center justify-between px-5 text-start text-[15px] text-ink transition-colors hover:bg-line active:bg-line',
                current && 'font-semibold',
              )}
            >
              <span className="flex items-center gap-2">
                {current && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ink" />}
                {item.label}
              </span>
              <Icon name="chevron-left" className="h-4 w-4 text-muted" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
