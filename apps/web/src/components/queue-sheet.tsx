import { useAtomValue, useSetAtom } from 'jotai';

import Queue from '@/components/queue';
import { queueOpenAtom } from '@/jotai/player';

/** Mobile only: the queue slides over the desk instead of stealing a column. */
export default function QueueSheet() {
  const open = useAtomValue(queueOpenAtom);
  const setOpen = useSetAtom(queueOpenAtom);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة التشغيل">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60"
      />
      <div
        className="absolute inset-x-0 bottom-0 flex h-[78dvh] flex-col rounded-t-lg border-t border-divider bg-canvas"
        style={{ animation: 'sheet-up 240ms cubic-bezier(0.2, 0, 0.2, 1)' }}
      >
        <div className="flex items-center justify-between border-b border-divider px-4 py-2">
          <span className="text-[12px] text-ink-tertiary">اسحب أو أغلق</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Queue className="min-h-0 flex-1" onPick={() => setOpen(false)} />
      </div>
    </div>
  );
}
