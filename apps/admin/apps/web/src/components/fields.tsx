import type { ReactElement } from 'react';
import { Field, Input } from './Field';
import { PasswordInput } from './PasswordInput';
import { PasswordStrength } from './PasswordStrength';
import type { IconName } from './icons';
import type { StrengthVariant } from './PasswordStrength';

/**
 * The form kit.
 *
 * Every field that repeats across the product lives here once, carrying the
 * attributes the browser, the password manager and the screen reader need:
 * `type`, `inputMode`, `autoComplete`, `name`, `spellCheck`. A screen that
 * composes from the kit cannot forget one of them, which is the whole point of
 * having a kit rather than copy-pasting the five lines again.
 *
 * The kit does not replace `Field` — it sits on top of it. `Field` owns the
 * label/control/hint/error layout and the generated id; the kit owns the control
 * and its attributes.
 */

export interface FieldCommon {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  autoCompleteOverride?: string;
}

export function EmailField({
  label,
  value,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  name = 'email',
  icon = 'mail',
}: FieldCommon & { name?: string; icon?: IconName }): ReactElement {
  return (
    <Field label={label} hint={hint} error={error} icon={icon}>
      {(id) => (
        <Input
          id={id}
          name={name}
          type="email"
          inputMode="email"
          autoComplete="email"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  hint,
  error,
  required = false,
  autoComplete,
  showStrength = false,
  strengthVariant = 'bars',
  minLength,
}: FieldCommon & {
  autoComplete: 'current-password' | 'new-password';
  showStrength?: boolean;
  strengthVariant?: StrengthVariant;
  minLength?: number;
}): ReactElement {
  return (
    <>
      <Field label={label} hint={hint} error={error} icon="lock">
        {(id) => (
          <PasswordInput
            id={id}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            required={required}
            minLength={minLength}
            invalid={Boolean(error)}
          />
        )}
      </Field>
      {showStrength ? <PasswordStrength value={value} variant={strengthVariant} /> : null}
    </>
  );
}

export function CodeField({
  label,
  value,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  name = 'code',
  maxLength = 6,
  pattern = '[0-9]*',
  inputMode = 'numeric',
  autoComplete = 'one-time-code',
}: FieldCommon & {
  name?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?: 'text' | 'numeric';
  autoComplete?: string;
}): ReactElement {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <Input
          id={id}
          name={name}
          type="text"
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          pattern={pattern}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function SearchField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  name = 'q',
}: FieldCommon & { placeholder?: string; name?: string }): ReactElement {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <Input
          id={id}
          name={name}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function NameField({
  label,
  value,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  name = 'name',
  autoComplete = 'name',
  placeholder,
}: FieldCommon & { name?: string; autoComplete?: string; placeholder?: string }): ReactElement {
  return (
    <Field label={label} hint={hint} error={error} icon="user">
      {(id) => (
        <Input
          id={id}
          name={name}
          type="text"
          autoComplete={autoComplete}
          spellCheck={false}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
