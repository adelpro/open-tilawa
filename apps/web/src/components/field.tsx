import { createContext, useContext, useId } from 'react';
import type { InputHTMLAttributes, ReactElement, TextareaHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

/**
 * What `Field` knows about the control it wraps: the id its hint and error
 * carry, and whether the field is invalid. The control reads it and adds
 * `aria-describedby` / `aria-invalid` itself, so a screen reader hears the hint
 * and the error as part of the field instead of as stray text after it.
 *
 * The anatomy is shared with the admin console; the tokens are not. This file
 * owns the shape (label above, control, hint, error) and the web palette; the
 * admin's copy owns the same shape in its own palette.
 */
type FieldContextValue = { describedBy?: string; invalid: boolean };

const FieldContext = createContext<FieldContextValue>({ invalid: false });

export function useFieldProps(): FieldContextValue {
  return useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactElement;
}): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.875rem] font-semibold text-ink">
        {label}
      </label>
      <FieldContext.Provider value={{ describedBy, invalid }}>
        {children(id)}
      </FieldContext.Provider>
      {hint && !error ? (
        <span id={hintId} className="text-[0.75rem] leading-relaxed text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-[0.75rem] leading-relaxed text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** One control height (44), one radius (8), one text size (16: no iOS zoom). */
const control =
  'w-full min-h-11 rounded-lg border border-line bg-transparent px-3 py-2 text-[1rem] text-ink placeholder:text-muted focus-visible:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  const field = useFieldProps();
  return (
    <input
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      {...props}
      className={cn(control, className)}
      aria-describedby={props['aria-describedby'] ?? field.describedBy}
      aria-invalid={props['aria-invalid'] ?? (field.invalid || undefined)}
    />
  );
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  const field = useFieldProps();
  return (
    <textarea
      spellCheck={false}
      {...props}
      className={cn(control, 'resize-none', className)}
      aria-describedby={props['aria-describedby'] ?? field.describedBy}
      aria-invalid={props['aria-invalid'] ?? (field.invalid || undefined)}
    />
  );
}
