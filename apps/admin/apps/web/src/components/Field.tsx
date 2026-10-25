import { useId } from 'react';
import type { InputHTMLAttributes, ReactElement, TextareaHTMLAttributes } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  /**
   * A decorative glyph at the start of the control. It is `aria-hidden` and never the
   * label: the label is the accessible name, and an icon that repeated it would make a
   * screen reader say "Email" twice.
   */
  icon?: IconName;
  children: (id: string) => ReactElement;
}

/** Label, control, hint and error — the error sits below the field, in words. */
export function Field({ label, hint, error, icon, children }: FieldProps): ReactElement {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={icon ? 'field__control field__control--icon' : 'field__control'}>
        {icon ? <Icon name={icon} className="field__icon" /> : null}
        {children(id)}
      </div>
      {hint && !error ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  // Merge rather than replace: a caller adding a modifier class must not silently lose
  // the base one, which is how a field ends up unstyled.
  return <input className={`field__input ${className}`.trim()} spellCheck={false} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea className="field__textarea" spellCheck={false} {...props} />;
}
