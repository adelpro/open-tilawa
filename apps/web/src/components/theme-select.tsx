import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';

import Icon from '@/components/icons';
import type { Theme } from '@/hooks/use-theme';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';
import { isCommitKey, nextOptionIndex } from '@/utils/listbox';
import { PALETTES, type PaletteId } from '@/utils/palettes';

/** The theme at control scale: the paper, and the ink it is printed with. */
function Swatch({ paper, ink }: { paper: string; ink: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-6 shrink-0 flex-col overflow-hidden rounded-[3px] border border-line"
    >
      <span className="block flex-1" style={{ background: paper }} />
      <span className="block flex-1" style={{ background: ink }} />
    </span>
  );
}

/**
 * The theme picker.
 *
 * A native `<select>` cannot do this: the spec only lets an `<option>` render
 * text, so the swatch — the one thing that says "this is a paper" — would be
 * lost. This is the same control built by hand, with the keyboard it owes:
 * arrows walk (no wrap), Home/End jump, Enter/Space choose, Escape closes.
 * The listbox receives real focus on its options rather than pretending with
 * `aria-activedescendant`, so a screen reader reads the option it is on.
 */
export default function ThemeSelect({
  value,
  mode,
  onChange,
  label,
}: {
  value: PaletteId;
  mode: Theme;
  onChange: (next: PaletteId) => void;
  label: string;
}): ReactElement {
  const { t } = useLocale();
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

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Opening puts focus on the chosen option, so the next arrow key walks from
  // where the person already is instead of from the top.
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

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
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
    <div ref={root} className="relative w-full">
      <button
        ref={trigger}
        type="button"
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-md border bg-surface px-3 text-start text-[0.9375rem] transition-colors',
          open ? 'border-ink' : 'border-line hover:border-ink/40',
        )}
        aria-label={`${label}: ${t.settings[active.label]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onTriggerKeyDown}
      >
        <Swatch paper={mode === 'dark' ? active.dark.paper : active.light.paper} ink={mode === 'dark' ? active.dark.ink : active.light.ink} />
        <span className="flex-1">{t.settings[active.label]}</span>
        <Icon name="expand" className={cn('text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-canvas shadow-lg"
        >
          {PALETTES.map((entry, index) => {
            const on = entry.id === value;
            const paint = mode === 'dark' ? entry.dark : entry.light;
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
                onClick={() => choose(entry.id)}
                onKeyDown={(event) => onOptionKeyDown(event, entry.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-[0.9375rem] outline-none',
                  'hover:bg-surface focus:bg-surface',
                  on ? 'font-semibold text-ink' : 'text-ink',
                )}
              >
                <Swatch paper={paint.paper} ink={paint.ink} />
                <span className="flex-1">{t.settings[entry.label]}</span>
                {on ? <Icon name="check" className="text-ink" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
