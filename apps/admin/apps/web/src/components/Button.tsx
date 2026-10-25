import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Spinner } from './icons';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  /**
   * A leading glyph. It occupies the same slot the spinner takes while the button is busy,
   * so the label never moves when a request starts — the button changes its icon, not its
   * word.
   */
  icon?: ReactNode;
  /**
   * The request this button started is in flight. The label stays as it is: replacing
   * "Save" with "Saving…" resizes the control under the cursor at the exact moment the
   * person is watching it.
   */
  busy?: boolean;
}

/**
 * One primary per view, and the class carries that intent — the design gives the
 * accent to interaction only, so a `tertiary` button is text and nothing else.
 */
export function Button({
  variant = 'primary',
  small = false,
  icon,
  busy = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps): ReactElement {
  const classes = ['btn', `btn--${variant}`, small ? 'btn--sm' : '', className]
    .filter(Boolean)
    .join(' ');
  const slot = busy ? <Spinner /> : icon;
  return (
    <button
      type={type}
      className={classes}
      // Busy disables, always: a second click while the request runs is a duplicate.
      disabled={Boolean(disabled) || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {slot ? (
        <span className="btn__icon" aria-hidden="true">
          {slot}
        </span>
      ) : null}
      {children}
    </button>
  );
}
