import type { KeyboardEvent, ReactElement } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * A tablist, once.
 *
 * The pattern is small but the details are not: one tab in the tab order, arrows to move
 * between them, Home and End at the ends, and an `aria-controls` that points at the panel
 * the tab owns. Three screens had copied it, and the copies had already drifted.
 *
 * `idPrefix` namespaces the generated ids so two tablists can share a page; pass `''` when
 * the plain `tab-*` ids are already the convention.
 */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
  idPrefix = '',
}: {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** The accessible name of the tablist, e.g. "Profile sections". */
  label: string;
  idPrefix?: string;
}): ReactElement {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          id={`${idPrefix}tab-${item.id}`}
          type="button"
          role="tab"
          className={`tab${active === item.id ? ' tab--active' : ''}`}
          aria-selected={active === item.id}
          aria-controls={active === item.id ? `${idPrefix}panel-${item.id}` : undefined}
          tabIndex={active === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
