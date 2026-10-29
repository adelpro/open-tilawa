import type { ReactNode } from 'react';

import Icon from '@/components/icons';
import { PLAYBACK_RATES } from '@/hooks/use-persistence';
import { useLocale } from '@/hooks/use-locale';
import type { Theme } from '@/hooks/use-theme';
import { LOCALES, type Locale } from '@/i18n/messages';
import { cn } from '@/utils/cn';
import { formatCountdown, SLEEP_OPTIONS } from '@/utils/sleep-timer';
import { type Visualiser, VISUALISERS } from '@/utils/visualiser-models';

const chip = 'min-h-8 shrink-0 rounded-full border px-3 py-1 text-[0.875rem] transition-colors';
const chipOn = 'border-ink bg-ink font-semibold text-invert';
const chipOff = 'border-line text-ink hover:border-ink/40';

function Group({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-1 text-muted">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[1rem] font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">{hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 ps-7">{children}</div>
    </section>
  );
}

/** Settings have their own route, so the menu stays a menu. */
export default function SettingsPage({
  theme,
  onTheme,
  locale,
  onLocale,
  rate,
  onRate,
  visualiser,
  onVisualiser,
  sleepActive,
  sleepRemaining,
  onSleep,
}: {
  theme: Theme;
  onTheme: (theme: Theme) => void;
  locale: Locale;
  onLocale: (locale: Locale) => void;
  rate: number;
  onRate: (rate: number) => void;
  visualiser: Visualiser;
  onVisualiser: (visualiser: Visualiser) => void;
  sleepActive: boolean;
  sleepRemaining: number;
  onSleep: (minutes: number) => void;
}) {
  const { t } = useLocale();

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <a
          href="#/"
          className="inline-flex min-h-11 items-center gap-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
        >
          <Icon name="back" className="text-muted" />
          {t.routes.listen}
        </a>

        <h1 className="mt-4 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">
          {t.settings.pageTitle}
        </h1>

        <div className="mt-6">
          <Group
            icon={<Icon name="sun" size={20} />}
            title={t.settings.appearance}
            hint={t.settings.appearanceHint}
          >
            {(['light', 'dark'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onTheme(value)}
                aria-pressed={theme === value}
                className={cn(chip, theme === value ? chipOn : chipOff)}
              >
                {value === 'light' ? (
                  <span className="flex items-center gap-2">
                    <Icon name="sun" />
                    {t.settings.light}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon name="moon" />
                    {t.settings.dark}
                  </span>
                )}
              </button>
            ))}
          </Group>

          <Group
            icon={<Icon name="globe" size={20} />}
            title={t.settings.language}
            hint={t.settings.languageHint}
          >
            {LOCALES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onLocale(value)}
                aria-pressed={locale === value}
                className={cn(chip, locale === value ? chipOn : chipOff)}
              >
                {value === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </Group>

          <Group
            icon={<Icon name="gauge" size={20} />}
            title={t.settings.speed}
            hint={t.settings.playbackHint}
          >
            {PLAYBACK_RATES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onRate(value)}
                aria-pressed={Math.abs(rate - value) < 0.001}
                className={cn(chip, Math.abs(rate - value) < 0.001 ? chipOn : chipOff)}
              >
                {Number(value.toFixed(2))}x
              </button>
            ))}
          </Group>

          <Group
            icon={<Icon name="sleep" size={20} />}
            title={t.settings.sleep}
            hint={`${t.settings.off} · ${t.settings.minutes(15)} · 30 · 60 · 90`}
          >
            {sleepActive && (
              <span className="tnum me-1 self-center text-[0.875rem] font-semibold text-ink">
                {formatCountdown(sleepRemaining)}
              </span>
            )}
            {SLEEP_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => onSleep(minutes)}
                aria-pressed={minutes === 0 ? !sleepActive : undefined}
                className={cn(chip, minutes === 0 && !sleepActive ? chipOn : chipOff)}
              >
                {minutes === 0 ? t.settings.off : t.settings.minutes(minutes)}
              </button>
            ))}
          </Group>

          <Group
            icon={<Icon name="waveform" size={20} />}
            title={t.settings.shape}
            hint={t.settings.shapeHint}
          >
            {VISUALISERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onVisualiser(value)}
                aria-pressed={visualiser === value}
                className={cn(chip, visualiser === value ? chipOn : chipOff)}
              >
                {t.shapes[value]}
              </button>
            ))}
          </Group>
        </div>
      </div>
    </main>
  );
}
