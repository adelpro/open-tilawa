import type { ReactElement } from 'react';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../lib/theme.tsx';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import { Icon } from './icons';

const OPTIONS: {
  value: 'light' | 'dark' | 'system';
  key: MessageKey;
  icon: 'sun' | 'moon' | 'monitor';
}[] = [
  { value: 'light', key: 'prefs.theme.light', icon: 'sun' },
  { value: 'dark', key: 'prefs.theme.dark', icon: 'moon' },
  { value: 'system', key: 'prefs.theme.system', icon: 'monitor' },
];

const ICON_MAP: Record<string, 'sun' | 'moon' | 'monitor'> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

/**
 * Monitor icon trigger + dropdown. Defaults to system.
 */
export function ThemeToggle({ className = '' }: { className?: string }): ReactElement {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`theme-toggle ${className}`.trim()} style={{ position: 'relative' }}>
      <button
        type="button"
        className="theme-toggle__trigger"
        aria-label={t('prefs.theme')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={ICON_MAP[theme]} size={16} />
      </button>
      {open && (
        <div className="theme-toggle__menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              aria-pressed={theme === opt.value}
              className={`theme-toggle__option${theme === opt.value ? ' theme-toggle__option--active' : ''}`}
              onClick={() => {
                setTheme(opt.value);
                setOpen(false);
              }}
            >
              <Icon name={opt.icon} size={16} />
              <span>{t(opt.key)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
