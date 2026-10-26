import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import type { Route } from '@/hooks/use-hash-route';
import { cn } from '@/utils/cn';
import { formatCountdown, SLEEP_OPTIONS } from '@/utils/sleep-timer';

const ITEMS: { route: Route; label: string }[] = [
  { route: '/', label: 'الاستماع' },
  { route: '/about', label: 'عن تلاوة' },
  { route: '/privacy', label: 'الخصوصية' },
];

/** The list of routes. One tap, no nested menus. */
export default function NavSheet({
  open,
  route,
  sleepActive,
  sleepRemaining,
  onSleep,
  onClose,
  onNavigate,
}: {
  open: boolean;
  route: Route;
  sleepActive: boolean;
  sleepRemaining: number;
  onSleep: (minutes: number) => void;
  onClose: () => void;
  onNavigate: (route: Route) => void;
}) {
  return (
    <Sheet title="القائمة" open={open} onClose={onClose} size="auto">
      <div className="border-b border-line pb-3">
        <div className="flex h-9 items-center justify-between px-5">
          <span className="text-[13px] text-muted">مؤقّت النوم</span>
          {sleepActive && (
            <span className="tnum text-[13px] font-semibold text-ink">
              {formatCountdown(sleepRemaining)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 pt-0.5">
          {SLEEP_OPTIONS.map((minutes) => {
            const active = (minutes === 0 && !sleepActive) || (minutes > 0 && sleepActive);
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => onSleep(minutes)}
                aria-pressed={minutes === 0 ? !sleepActive : undefined}
                className={cn(
                  'h-8 rounded-full border px-3 text-[13px] transition-colors',
                  minutes === 0 && !sleepActive
                    ? 'border-ink bg-ink font-semibold text-invert'
                    : 'border-line text-ink hover:border-ink/40',
                )}
              >
                {minutes === 0 ? 'إيقاف' : `${minutes} د`}
              </button>
            );
          })}
        </div>
      </div>

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
                'flex h-11 w-full items-center justify-between px-5 text-start text-[15px] text-ink transition-colors hover:bg-line active:bg-line',
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
