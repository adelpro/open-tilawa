import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './Button';
import { Notice } from './Chip';
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
  error,
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
  /** A refused submit, shown in the dialog instead of behind the scrim. */
  error?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const { t } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  /** Any input or change since the dialog opened means leaving would lose text. */
  const touched = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // A form is for typing, so the first field takes focus; a question keeps the panel's
  // focus, which is why this lives here and not in Modal. One frame later, because the
  // dialog's own focus pass and any field that renders from state both land first.
  useEffect(() => {
    const field = form.current?.querySelector<HTMLElement>('input, textarea, select');
    if (!field) return;
    const frame = requestAnimationFrame(() => field.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Escape, the X and the scrim ask this before leaving. A clean form closes;
   * a dirty one gets the prompt rather than losing the text silently.
   */
  const guard = (): boolean => {
    if (busy) return false;
    if (!touched.current) return true;
    setConfirmDiscard(true);
    return false;
  };

  const requestClose = (): void => {
    if (!guard()) return;
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose} dismissible={!busy} beforeClose={guard}>
      <form
        ref={form}
        className="stack"
        onInput={() => {
          touched.current = true;
        }}
        onChange={() => {
          touched.current = true;
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !disabled) onSubmit();
        }}
      >
        {children}
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {confirmDiscard ? (
          <div className="modal__guard stack" role="alert">
            <p className="body">{t('common.discardBody')}</p>
            <div className="cluster cluster--end">
              <Button variant="tertiary" onClick={() => setConfirmDiscard(false)}>
                {t('common.keepEditing')}
              </Button>
              <Button variant="destructive" onClick={onClose}>
                {t('common.discard')}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="cluster cluster--end modal__footer">
          {extra}
          <Button variant="tertiary" onClick={requestClose} disabled={busy}>
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
