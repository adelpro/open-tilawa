import { createContext, useContext, useId } from 'react';
import type { InputHTMLAttributes, ReactElement, TextareaHTMLAttributes } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

/**
 * What `Field` knows about the control it wraps: the ids its hint and error
 * carry, and whether the field is currently invalid. The control reads it and
 * adds `aria-describedby` / `aria-invalid` itself, so a screen reader hears the
 * hint and the error as part of the field — before this, both were rendered and
 * neither was associated, so the error was announced on its own with no clue
 * which input it belonged to.
 */
type FieldContextValue = { describedBy?: string; invalid: boolean };

const FieldContext = createContext<FieldContextValue>({ invalid: false });

export function useFieldProps(): FieldContextValue {
  return useContext(FieldContext);
}

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
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={icon ? 'field__control field__control--icon' : 'field__control'}>
        {icon ? <Icon name={icon} className="field__icon" /> : null}
        <FieldContext.Provider value={{ describedBy, invalid }}>
          {children(id)}
        </FieldContext.Provider>
      </div>
      {hint && !error ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId} role="alert">
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
  const field = useFieldProps();
  // Merge rather than replace: a caller adding a modifier class must not silently lose
  // the base one, which is how a field ends up unstyled.
  return (
    <input
      className={`field__input ${className}`.trim()}
      spellCheck={false}
      {...props}
      aria-describedby={props['aria-describedby'] ?? field.describedBy}
      aria-invalid={props['aria-invalid'] ?? (field.invalid || undefined)}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  const field = useFieldProps();
  return (
    <textarea
      className="field__textarea"
      spellCheck={false}
      {...props}
      aria-describedby={props['aria-describedby'] ?? field.describedBy}
      aria-invalid={props['aria-invalid'] ?? (field.invalid || undefined)}
    />
  );
}
