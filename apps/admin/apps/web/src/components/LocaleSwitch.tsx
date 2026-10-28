import type { ReactElement } from 'react';
import { useState, useRef, useEffect } from 'react';
import { LOCALES, useI18n } from '../lib/i18n';
import type { Locale } from '../lib/i18n';
import { Icon } from './icons';

const NAME: Record<Locale, string> = { en: 'English', ar: 'العربية' };
const SHORT: Record<Locale, string> = { en: 'EN', ar: 'AR' };

/**
 * Globe icon + dropdown. Clicking the globe opens a small menu of
 * available languages; the current one is marked active.
 */
export function LocaleSwitch({ className = '' }: { className?: string }): ReactElement {
  const { locale, setLocale, t } = useI18n();
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
    <div ref={ref} className={`locale-switch ${className}`.trim()} style={{ position: 'relative' }}>
      <button
        type="button"
        className="locale-switch__trigger"
        /* The visible label is the language code, so the accessible name has to
           contain it — an aria-label that replaces "EN" with "Language" fails
           WCAG 2.5.3 (label in name). "English (EN)" reads naturally and keeps
           the code. */
        aria-label={`${NAME[locale]} (${SHORT[locale]})`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="globe" size={18} />
        <span className="locale-switch__current">{SHORT[locale]}</span>
      </button>
      {open && (
        <div className="locale-switch__menu" role="menu">
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitem"
              lang={option}
              aria-pressed={locale === option}
              className={`locale-switch__option${locale === option ? ' locale-switch__option--active' : ''}`}
              onClick={() => {
                void setLocale(option);
                setOpen(false);
              }}
            >
              {NAME[option]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
