import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import { Icon } from './icons';

/** The same duration the stylesheet uses for `.modal`; the exit has to match the enter. */
const EXIT_MS = 180;

/**
 * Two uses only, per the design: the one-time key reveal and a destructive
 * confirmation. Dismissal is explicit — Escape or the cancel button — and the
 * key reveal refuses to close until it is acknowledged.
 *
 * Motion, added in P12: the panel scales from the control that opened it rather than from
 * its own centre (spatial consistency — a thing should appear where it came from), and it
 * leaves by the same path it arrived on. The closing frame is real state, not a class left
 * behind: Escape during the exit is ignored rather than queued, and the caller is told once,
 * after the animation, so nothing unmounts mid-fade.
 */
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
  alert = false,
  describedBy,
  beforeClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  /** An urgent confirmation: `alertdialog` makes a screen reader announce it as one. */
  alert?: boolean;
  /** Ids of the text that explains the dialog, not just its title. */
  describedBy?: string;
  /**
   * A veto the dialog asks before it starts leaving. A form with unsaved text
   * returns false and shows its own prompt — the check must run before the exit
   * begins, or a veto leaves an invisible panel in the top layer.
   */
  beforeClose?: () => boolean;
}): ReactElement {
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const titleId = useId();
  const { t } = useI18n();

  // Anchor the scale to whatever had focus when the dialog opened — the button, in every
  // current use. Measured before the panel is transformed, so the origin is in the
  // panel's own coordinate space.
  useEffect(() => {
    trigger.current = document.activeElement as HTMLElement | null;
    const box = panel.current?.getBoundingClientRect();
    const from = trigger.current?.getBoundingClientRect();
    if (!box || !from || !from.width) return;
    const x = Math.round(from.left + from.width / 2 - box.left);
    const y = Math.round(from.top + from.height / 2 - box.top);
    setOrigin(`${x}px ${y}px`);
  }, []);

  const close = useCallback((): void => {
    if (closing) return;
    if (beforeClose && !beforeClose()) return;
    setClosing(true);
    // The exit is a scale under normal motion and a cross-fade under reduced motion, but it
    // is an exit either way — so the wait is the same and the caller is told once, after it.
    timer.current = window.setTimeout(onClose, EXIT_MS);
  }, [closing, onClose, beforeClose]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A dialog owns the viewport while it is open: the page behind it must not move, and the
  // scrollbar it removes must not shift the layout sideways. Both are put back on unmount.
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPaddingInlineEnd = body.style.paddingInlineEnd;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPaddingInlineEnd;
    };
  }, []);

  // Focus leaves with the dialog: returning it to the trigger is what makes the next Tab
  // land where the person was, rather than at the top of the page.
  useEffect(() => {
    const opener = trigger.current;
    return () => {
      if (opener && document.body.contains(opener)) opener.focus();
    };
  }, []);

  // The panel takes focus once, on mount. Kept out of the listener effect below:
  // `close` is rebuilt whenever the caller re-renders (its `onClose` is usually an
  // inline arrow), and re-running that effect used to pull focus back to the dialog
  // on every keystroke — which breaks a form the moment its state lifts.
  useEffect(() => {
    panel.current?.focus();
  }, []);

  // The listener reads the latest `close` through a ref, so it is attached once.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && dismissible) {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // A dialog that opens over the page must not let Tab walk out from behind it: without
      // this, tabbing past the last control lands on the sidebar underneath, which is both
      // invisible and clickable. Cycle at the ends instead.
      const controls = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls || controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible]);

  const dialog = (
    <div
      className={`scrim${closing ? ' scrim--closing' : ''}`}
      onClick={dismissible ? close : undefined}
      role="presentation"
    >
      <div
        className={`modal${closing ? ' modal--closing' : ''}`}
        style={{ transformOrigin: origin }}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        ref={panel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id={titleId} className="panel__title">
            {title}
          </h2>
          {dismissible ? (
            <button
              type="button"
              className="modal__close"
              onClick={close}
              aria-label={t('common.close')}
            >
              <Icon name="close" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );

  /*
   * The scrim belongs to <body>, not to whichever route opened it. A transformed
   * ancestor would otherwise trap the fixed overlay in that route's stacking
   * context — behind the topbar and the page notices it is meant to cover.
   */
  return createPortal(dialog, document.body);
}
