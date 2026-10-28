import type { ReactElement, ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { useI18n } from '../lib/i18n';

/**
 * One dialog for every destructive action in the console.
 *
 * Hand-rolled confirms drifted into three different shapes — some with a body, some
 * with a hint, one whose button repeated the word "cancel" — so the rules live here
 * instead: the confirm names its own verb, the safe choice is the one in the same
 * place every time, and the body says what survives the action.
 */
export function ConfirmModal({
  title,
  body,
  hint,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  /** What the action does, in one sentence. */
  body?: ReactNode;
  /** The part worth reading twice — what is left alone. */
  hint?: ReactNode;
  /** An imperative that is not the word "cancel" (e.g. أزل, افصل, احذف). */
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Extra controls that change what the confirm does — a purge checkbox, say. */
  children?: ReactNode;
}): ReactElement {
  const { t } = useI18n();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        {body ? <p className="body">{body}</p> : null}
        {children}
        {hint ? <p className="fine-print">{hint}</p> : null}
        <div className="cluster cluster--end">
          <Button variant="tertiary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            busy={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
