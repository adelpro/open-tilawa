/**
 * First run: one screen that says what this is before it asks for a gigabyte.
 *
 * It is a view, not a modal — the nav still works, so "skip" is just leaving. It
 * appears once; the flag lives beside the other preferences.
 */

import type { Copy } from '@/lib/i18n';
import { hrefFor } from '@/lib/router';

export function WelcomeView({ copy, onDone }: { copy: Copy; onDone: () => void }) {
  return (
    <section id="welcome" className="screen welcome" aria-labelledby="welcome-title">
      <img className="welcome-mark" src="/icon/128.png" alt="" width={88} height={88} />

      <h1 id="welcome-title">{copy.welcomeTitle}</h1>
      <p className="lede">{copy.welcomeLede}</p>

      <ul className="welcome-points">
        <li>{copy.welcomePoint1}</li>
        <li>{copy.welcomePoint2}</li>
        <li>{copy.welcomePoint3}</li>
        <li>{copy.welcomePoint4}</li>
      </ul>

      <div className="welcome-actions">
        <a className="button-primary" href={hrefFor('reciters')} onClick={onDone}>
          {copy.welcomeCta}
        </a>
        <button type="button" className="quiet" onClick={onDone}>
          {copy.welcomeSkip}
        </button>
      </div>
    </section>
  );
}
