import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { useI18n } from '../lib/i18n';

/**
 * One dialog for every create and edit in the console.
 *
 * The inline panels this replaces had three costs: they pushed the list down (the list
 * is why the operator is on the screen), they turned the header's primary button into a
 * Cancel toggle, and each one invented its own footer. Here the footer is the same
 * everywhere, Enter submits, Escape cancels, and focus starts in the first field rather
 * than on the dialog itself.
 */
export function FormModal({
  title,
  submitLabel,
  onSubmit,
  onClose,
  busy = false,
  disabled = false,
  extra,
  children,
}: {
  title: string;
  /** What the button does — `أضف` for a create, `احفظ` for an edit. Never the dialog title. */
  submitLabel: string;
  onSubmit: () => void;
  onClose: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** An action that belongs to this record rather than to the form (clear credentials). */
  extra?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const { t } = useI18n();
  const form = useRef<HTMLFormElement>(null);

  // A form is for typing, so the first field takes focus; a question keeps the panel's
  // focus, which is why this lives here and not in Modal. One frame later, because the
  // dialog's own focus pass and any field that renders from state both land first.
  useEffect(() => {
    const field = form.current?.querySelector<HTMLElement>('input, textarea, select');
    if (!field) return;
    const frame = requestAnimationFrame(() => field.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Modal title={title} onClose={onClose}>
      <form
        ref={form}
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !disabled) onSubmit();
        }}
      >
        {children}
        <div className="cluster cluster--end">
          {extra}
          <Button variant="tertiary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" busy={busy} disabled={disabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
