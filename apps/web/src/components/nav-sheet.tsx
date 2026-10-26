import { useState } from 'react';

import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import type { Route } from '@/hooks/use-hash-route';
import { cn } from '@/utils/cn';
import { formatCountdown, SLEEP_OPTIONS } from '@/utils/sleep-timer';
import { type Visualiser, VISUALISER_LABELS, VISUALISERS } from '@/utils/visualiser-models';

const chip = 'h-8 shrink-0 rounded-full border px-3 text-[13px] transition-colors';
const chipOn = 'border-ink bg-ink font-semibold text-invert';
const chipOff = 'border-line text-ink hover:border-ink/40';

function Disclosure({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between px-5 text-start text-[15px] text-ink transition-colors hover:bg-line active:bg-line"
      >
        <span className="flex items-center gap-2">
          <Icon
            name="chevron-left"
            className={cn('h-3.5 w-3.5 text-muted transition-transform', open && '-rotate-90')}
          />
          {label}
        </span>
        <span className="tnum text-[13px] font-semibold text-muted">{value}</span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

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
  rate,
  onRate,
  visualiser,
  onVisualiser,
  onClose,
  onNavigate,
}: {
  open: boolean;
  route: Route;
  sleepActive: boolean;
  sleepRemaining: number;
  onSleep: (minutes: number) => void;
  rate: number;
  onRate: (rate: number) => void;
  visualiser: Visualiser;
  onVisualiser: (visualiser: Visualiser) => void;
  onClose: () => void;
  onNavigate: (route: Route) => void;
}) {
  const [showSleep, setShowSleep] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showShape, setShowShape] = useState(false);

  return (
    <Sheet title="القائمة" open={open} onClose={onClose} size="auto">
      <Disclosure
        label="مؤقّت النوم"
        value={sleepActive ? formatCountdown(sleepRemaining) : 'إيقاف'}
        open={showSleep}
        onToggle={() => setShowSleep((v) => !v)}
      >
        <div className="flex flex-wrap gap-1.5 px-5">
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
      </Disclosure>

      <Disclosure
        label="السرعة"
        value={`${Number(rate.toFixed(2))}x`}
        open={showSpeed}
        onToggle={() => setShowSpeed((v) => !v)}
      >
        <div className="flex flex-wrap gap-1.5 px-5">
          {[0.75, 1, 1.25, 1.5, 2].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRate(value)}
              aria-pressed={Math.abs(rate - value) < 0.001}
              className={cn(
                'tnum h-8 rounded-full border px-3 text-[13px] transition-colors',
                Math.abs(rate - value) < 0.001
                  ? 'border-ink bg-ink font-semibold text-invert'
                  : 'border-line text-ink hover:border-ink/40',
              )}
            >
              {Number(value.toFixed(2))}x
            </button>
          ))}
        </div>
      </Disclosure>

      <Disclosure
        label="شكل الطيف"
        value={VISUALISER_LABELS[visualiser]}
        open={showShape}
        onToggle={() => setShowShape((v) => !v)}
      >
        <div className="flex flex-wrap gap-1.5 px-5">
          {VISUALISERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onVisualiser(value)}
              aria-pressed={visualiser === value}
              className={cn(chip, visualiser === value ? chipOn : chipOff)}
            >
              {VISUALISER_LABELS[value]}
            </button>
          ))}
        </div>
      </Disclosure>

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
