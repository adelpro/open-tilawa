import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from './Button';
import { Icon } from './icons';

export type MultiOption = { id: string; label: string };

/**
 * A select-shaped control that keeps more than one option.
 *
 * The closed control reads like the other selects on the row — same height,
 * border, type and chevron — so the toolbar does not grow a second language.
 * What it opens is a checkbox per source: choosing one does not replace the
 * previous choice, and the panel stays open while several are ticked.
 *
 * Escape closes the panel and returns focus to the button; a pointer outside
 * closes it. The panel is always in the DOM (hidden) so `aria-controls` points
 * at something that exists.
 */
export function MultiSelect({
  label,
  summary,
  options,
  selected,
  onToggle,
  onClear,
  clearLabel,
}: {
  /** The control's own name, for the button and the checkbox group. */
  label: string;
  /** What the closed control reads: "All providers", a name, or a count. */
  summary: string;
  options: MultiOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  clearLabel: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="multi-select" ref={root}>
      <button
        ref={button}
        type="button"
        className="field__select multi-select__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="multi-select__summary">{summary}</span>
        <Icon name="down" size={16} />
      </button>
      <div
        className="multi-select__panel"
        id={panelId}
        role="group"
        aria-label={label}
        hidden={!open}
      >
        {options.map((option) => (
          <label className="multi-select__option" key={option.id}>
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {selected.length > 0 ? (
          <Button small variant="tertiary" onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
