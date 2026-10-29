import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from './Button';

/**
 * A copy-paste block. The copy action is a button rather than an icon, because
 * the design reserves icons for things that act and this one has to be obvious on
 * a phone.
 */
export function CopyLine({
  value,
  label = 'Copy',
  title,
  hint,
}: {
  value: string;
  label?: string;
  /**
   * What this command does, in words. Two commands that both start with `curl`
   * look interchangeable until each one is named.
   */
  title?: string;
  hint?: string;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="stack stack--tight">
      {title ? <p className="code-line__title">{title}</p> : null}
      <pre className="code-line">{value}</pre>
      {hint ? <p className="fine-print">{hint}</p> : null}
      <div>
        <Button variant="secondary" small onClick={() => void copy()}>
          {copied ? 'Copied' : label}
        </Button>
      </div>
    </div>
  );
}
