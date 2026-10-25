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
}: {
  value: string;
  label?: string;
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
      <pre className="code-line">{value}</pre>
      <div>
        <Button variant="secondary" small onClick={() => void copy()}>
          {copied ? 'Copied' : label}
        </Button>
      </div>
    </div>
  );
}
