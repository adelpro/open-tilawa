import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './Button';

/**
 * A button that knows it is waiting.
 *
 * Every handler in this app is an `async` call that ends in `setBusy(false)` by hand, and
 * a hand-written flag is exactly the kind of state that gets forgotten in one of eight
 * panels. This owns it: the promise decides, the button shows the spinner in its icon slot,
 * and the label never changes. A second click while it runs is ignored rather than queued.
 */
export function AsyncButton({
  onClick,
  children,
  ...rest
}: {
  onClick?: () => Promise<unknown> | void;
  children: ReactNode;
  [key: string]: unknown;
}): ReactElement {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      {...rest}
      busy={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void Promise.resolve(onClick?.()).finally(() => setBusy(false));
      }}
    >
      {children}
    </Button>
  );
}
