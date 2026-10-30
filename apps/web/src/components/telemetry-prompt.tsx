import { useState } from 'react';

import { useLocale } from '@/hooks/use-locale';

/**
 * The one question this app asks about itself.
 *
 * Asked after the first playback that produced sound, never at first paint: before that,
 * nobody knows what is being measured and the question is noise. The checkbox starts
 * unchecked and the button stays disabled until it is ticked — consent is an act, not a
 * default — and `ليس الآن` closes it for good, leaving the switch in Settings.
 */
export default function TelemetryPrompt({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useLocale();
  const [agreed, setAgreed] = useState(false);

  return (
    <div
      role="dialog"
      aria-labelledby="telemetry-prompt-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-line bg-canvas p-4 shadow-lg"
    >
      <h2 id="telemetry-prompt-title" className="text-[1rem] font-semibold text-ink">
        {t.telemetry.title}
      </h2>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">{t.telemetry.nudge}</p>

      <label className="mt-3 flex items-start gap-2 text-[0.875rem] text-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span>{t.telemetry.consent}</span>
      </label>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="rounded-lg px-3 py-2 text-[0.875rem] text-muted hover:bg-line/50"
        >
          {t.telemetry.later}
        </button>
        <button
          type="button"
          disabled={!agreed}
          onClick={onAccept}
          className="rounded-lg bg-ink px-4 py-2 text-[0.875rem] text-canvas disabled:opacity-40"
        >
          {t.telemetry.accept}
        </button>
      </div>
    </div>
  );
}
