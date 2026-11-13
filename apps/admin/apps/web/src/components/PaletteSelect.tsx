import type { ReactElement, KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { useI18n } from '../lib/i18n';
import { isCommitKey, nextOptionIndex } from '../lib/listbox';
import { PALETTES, type PaletteId, type PaletteSwatch } from '../lib/palettes';
import { Icon } from './icons';

function Swatch({ paper, accent }: PaletteSwatch): ReactElement {
  return (
    <span className="palette-select__swatch" aria-hidden="true">
      <span className="palette-select__paper" style={{ background: paper }} />
      <span className="palette-select__ink" style={{ background: accent }} />
    </span>
  );
}

/**
 * The console's theme picker.
 *
 * The same control the player uses, for the same reason: an `<option>` may only
 * render text, so a native `<select>` cannot paint the paper it is offering.
 * Options take real focus (no `aria-activedescendant`), arrows walk without
 * wrapping, Home/End jump, Enter/Space choose, Escape closes and returns focus.
 */
export function PaletteSelect({
  id,
  value,
  resolved,
  onChange,
}: {
  id?: string;
  value: PaletteId;
  resolved: 'light' | 'dark';
  onChange: (next: PaletteId) => void;
}): ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  const current = Math.max(
    PALETTES.findIndex((entry) => entry.id === value),
    0,
  );
  const active = PALETTES[current];
  const paint = (entry: (typeof PALETTES)[number]) => (resolved === 'dark' ? entry.dark : entry.light);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) options.current[current]?.focus();
  }, [open, current]);

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const choose = (id: PaletteId): void => {
    onChange(id);
    close();
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: PaletteId): void => {
    if (isCommitKey(event.key)) {
      event.preventDefault();
      choose(id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const next = nextOptionIndex(Number(event.currentTarget.dataset.index), PALETTES.length, event.key);
    if (next !== null) {
      event.preventDefault();
      options.current[next]?.focus();
    }
  };

  return (
    <div className="palette-select" ref={root}>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="palette-select__trigger"
        aria-label={`${t('prefs.palette')}: ${t(active.label)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Swatch {...paint(active)} />
        <span className="palette-select__name">{t(active.label)}</span>
        <Icon name="down" size={16} />
      </button>

      {open ? (
        <ul id={listId} role="listbox" aria-label={t('prefs.palette')} className="palette-select__menu">
          {PALETTES.map((entry, index) => {
            const on = entry.id === value;
            return (
              <li
                key={entry.id}
                ref={(element) => {
                  options.current[index] = element;
                }}
                role="option"
                aria-selected={on}
                tabIndex={-1}
                data-index={index}
                className="palette-select__option"
                onClick={() => choose(entry.id)}
                onKeyDown={(event) => onOptionKeyDown(event, entry.id)}
              >
                <Swatch {...paint(entry)} />
                <span className="palette-select__name">{t(entry.label)}</span>
                {on ? <Icon name="check" size={16} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
