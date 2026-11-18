import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

const MENU_WIDTH = 192;
const MENU_HEIGHT = 160;

/**
 * A real popup menu for a table row.
 *
 * The panel is portalled to `body` and positioned `fixed`, because a table's
 * `overflow` container would clip an absolutely positioned child. It closes on
 * outside pointerdown, Escape, scroll and resize, and returns focus to the button
 * on Escape.
 */
export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: RowMenuItem[];
}): ReactElement {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({
    left: 0,
    top: 0,
  });

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = rect.bottom + MENU_HEIGHT < window.innerHeight;
    setPosition(
      below
        ? { left, top: rect.bottom + 6 }
        : { left, bottom: window.innerHeight - rect.top + 6 },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    const frame = window.requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn btn--tertiary btn--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={panel}
              id={id}
              role="menu"
              className="menu-popover"
              style={position}
            >
              {items.map((item) => (
                <Button
                  key={item.label}
                  small
                  variant={item.destructive ? 'destructive' : 'tertiary'}
                  className="menu-popover__item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
