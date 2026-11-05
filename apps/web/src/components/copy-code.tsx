import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons';
import { cn } from '@/utils/cn';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * A command a person copies, not a code sample to read.
 *
 * The string is the value: no wrapping character, no Arabic punctuation, no bidi
 * mark. The display may wrap; the clipboard does not.
 */
export default function CopyCode({
  value,
  title,
  label,
  copiedLabel,
  failedLabel,
}: {
  value: string;
  title: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2400);
  };

  const message = state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : '';

  return (
    <div className="mt-4 bg-line/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            'press inline-flex min-h-9 items-center gap-2 px-3 text-[0.8125rem]',
            state === 'copied' ? 'text-ink' : 'bg-ink text-invert',
          )}
        >
          {state === 'copied' ? <Icon name="check" size={16} /> : null}
          {state === 'idle' ? label : state === 'copied' ? copiedLabel : failedLabel}
        </button>
      </div>
      <pre dir="ltr" className="mt-3 overflow-x-auto text-left font-mono text-[0.75rem] leading-relaxed text-ink">
        <code className="whitespace-pre-wrap break-words">{value}</code>
      </pre>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}
