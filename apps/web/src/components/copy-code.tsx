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
  open,
}: {
  value: string;
  title: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
  /**
   * An optional hand-off to whatever app owns `magnet:` on this device.
   *
   * It is a plain anchor, not a call into a client: the browser asks the
   * operating system, and nothing happens where no handler is registered — which
   * is why it sits beside Copy rather than replacing it.
   */
  open?: { href: string; label: string; name?: string };
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
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
          {open ? (
            <a
              href={open.href}
              className="press inline-flex min-h-9 items-center gap-2 border border-line px-3 text-[0.8125rem] text-ink"
            >
              {open.label}
              {open.name ? <span className="sr-only"> - {open.name}</span> : null}
            </a>
          ) : null}
        </div>
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
