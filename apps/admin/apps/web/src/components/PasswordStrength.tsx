import type { ReactElement } from 'react';
import { Icon } from './icons';
import { useI18n } from '../lib/i18n';
import { checkPassword, scorePassword } from '../lib/password';
import type { PasswordRule } from '../lib/password';

/**
 * A password meter that says which rule is still open.
 *
 * Three presentations, one score. The score comes from the API's own rules — five checks, and
 * a password cannot reach the top step while one is unmet — so the meter and the refusal that
 * follows a submit agree. A meter that disagrees with the server is worse than none: it
 * teaches the person that a green bar means nothing.
 *
 * `variant` exists because the presentation is a taste decision, not a correctness one:
 * - `bars` (default): four segments and a word, then the unmet rule in one line
 * - `meter`: a single continuous bar with the word inside it
 * - `checklist`: no bar at all, just the five rules ticking — quieter, more informative
 */
export type StrengthVariant = 'bars' | 'meter' | 'checklist';

const RULES: PasswordRule[] = ['length', 'upper', 'lower', 'digit', 'common'];

const ruleLabel = (t: ReturnType<typeof useI18n>['t'], rule: PasswordRule): string => {
  switch (rule) {
    case 'length':
      return t('strength.rule.length', { count: 8 });
    case 'upper':
      return t('strength.rule.upper');
    case 'lower':
      return t('strength.rule.lower');
    case 'digit':
      return t('strength.rule.digit');
    default:
      return t('strength.rule.common');
  }
};

export function PasswordStrength({
  value,
  variant = 'bars',
}: {
  value: string;
  variant?: StrengthVariant;
}): ReactElement | null {
  const { t } = useI18n();
  if (value.length === 0) return null;

  const { level, checks } = scorePassword(value);
  const words = [
    t('strength.level.empty'),
    t('strength.level.weak'),
    t('strength.level.fair'),
    t('strength.level.good'),
    t('strength.level.strong'),
  ];
  const unmet = checkPassword(value)
    .filter((check) => !check.met)
    .map((check) => check.rule);

  return (
    <div className={`strength strength--${variant} strength--l${level}`} data-level={level}>
      {variant !== 'checklist' ? (
        <div className="strength__bar" aria-hidden="true">
          {variant === 'meter' ? (
            <span className="strength__fill" style={{ inlineSize: `${(level / 4) * 100}%` }} />
          ) : (
            [1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`strength__segment${step <= level ? ' strength__segment--on' : ''}`}
              />
            ))
          )}
        </div>
      ) : null}

      <p className="strength__word" role="status" aria-live="polite">
        {words[level]}
        {unmet.length > 0 && variant !== 'checklist' ? (
          <span className="strength__next"> · {ruleLabel(t, unmet[0])}</span>
        ) : null}
      </p>

      {variant === 'checklist' ? (
        <ul className="strength__rules">
          {RULES.map((rule) => {
            const check = checks.find((entry) => entry.rule === rule);
            return (
              <li key={rule} className={check?.met ? 'is-met' : undefined}>
                {check?.met ? <Icon name="check" /> : <span aria-hidden="true">·</span>} {ruleLabel(t, rule)}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
