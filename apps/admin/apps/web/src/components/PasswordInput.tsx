import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import { Icon } from './icons';
import { useI18n } from '../lib/i18n';

/**
 * A password field with a reveal control.
 *
 * The button is a toggle, not a checkbox: `aria-pressed` tells a screen reader the current
 * state and the label changes with it, because "Show password" that stays "Show password"
 * after the password is showing is a control lying about itself. The input keeps its type
 * swap in place — the value and focus are untouched, which is what makes it usable when the
 * thing being typed is wrong.
 *
 * It renders a fragment so it can sit inside `Field`'s control wrapper, which already
 * positions the leading icon.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy,
  required = false,
  invalid = false,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  describedBy?: string;
  required?: boolean;
  invalid?: boolean;
  minLength?: number;
}): ReactElement {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);

  return (
    <>
      <input
        id={id}
        className="field__input field__input--reveal"
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="field__reveal"
        aria-pressed={shown}
        aria-label={shown ? t('common.hidePassword') : t('common.showPassword')}
        title={shown ? t('common.hidePassword') : t('common.showPassword')}
        onClick={() => setShown((current) => !current)}
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </>
  );
}
