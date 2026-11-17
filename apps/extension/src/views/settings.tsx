/**
 * The settings view: four decisions about someone else's machine.
 *
 * The page reads in the order the decisions are made: what this device holds
 * (mode, caps), how much room it may take (the disk budget and its meter),
 * when it may run (the pauses, rendered only when the browser can measure the
 * thing they pause on — a toggle that silently does nothing is worse than no
 * toggle), and how much it gives back (the upload ceiling).
 *
 * The upload field keeps the raw string; parsing happens on save, so `0` means
 * "do not upload" instead of turning into the default.
 */

import { formatBytes } from '@/lib/badge';
import type { Settings } from '@/lib/settings';
import { BYTES_PER_GB } from '@/lib/settings';
import type { Copy } from '@/lib/i18n';

export function SettingsView({
  copy,
  settings,
  uploadDraft,
  heldBytes,
  canReadBattery,
  canReadConnection,
  onSettings,
  onUploadDraft,
}: {
  copy: Copy;
  settings: Settings;
  uploadDraft: string;
  /** What the held roster occupies today, for the disk meter. */
  heldBytes: number;
  canReadBattery: boolean;
  canReadConnection: boolean;
  onSettings: (next: Settings) => void;
  onUploadDraft: (value: string) => void;
}) {
  const budget = settings.maxDiskGb * BYTES_PER_GB;
  const modes = [
    { value: 'manual', title: copy.modeManual, hint: copy.modeManualHint },
    { value: 'follow', title: copy.modeFollow, hint: copy.modeFollowHint },
    { value: 'mixed', title: copy.modeMixed, hint: copy.modeMixedHint },
  ] as const;

  return (
    <section id="settings" className="screen" aria-labelledby="settings-title">
      <h2 id="settings-title">{copy.settings}</h2>

      <div className="settings-section">
        <h3 className="section-title">{copy.secHolding}</h3>

        <div className="mode-cards" role="radiogroup" aria-label={copy.modeLabel}>
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`mode-card${settings.mode === mode.value ? ' selected' : ''}`}
            >
              <input
                type="radio"
                name="mode"
                value={mode.value}
                checked={settings.mode === mode.value}
                onChange={() => onSettings({ ...settings, mode: mode.value })}
              />
              <span className="name">{mode.title}</span>
              <span className="meta">{mode.hint}</span>
            </label>
          ))}
        </div>

        <div className="grid">
          <div className="field">
            <label htmlFor="max-reciters">{copy.maxReciters}</label>
            <select
              id="max-reciters"
              value={settings.maxReciters}
              onChange={(event) => onSettings({ ...settings, maxReciters: Number(event.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <small>{copy.maxRecitersHint}</small>
          </div>

          {settings.mode !== 'manual' ? (
            <div className="field">
              <label htmlFor="follow-cap">{copy.followCapLabel}</label>
              <select
                id="follow-cap"
                value={settings.followCap}
                onChange={(event) => onSettings({ ...settings, followCap: Number(event.target.value) })}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <small>{copy.followCapHint}</small>
            </div>
          ) : null}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">{copy.secSpace}</h3>
        <div className="grid">
          <div className="field">
            <label htmlFor="max-disk">{copy.maxDiskLabel}</label>
            <select
              id="max-disk"
              value={settings.maxDiskGb}
              onChange={(event) => onSettings({ ...settings, maxDiskGb: Number(event.target.value) })}
            >
              {[0, 3, 6, 10, 20, 30, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? copy.diskUnlimited : `${value} GB`}
                </option>
              ))}
            </select>
            <small>{copy.maxDiskHint}</small>
          </div>
        </div>
        <p className="meta disk-meter">
          {copy.diskUsed}: <bdi>{formatBytes(heldBytes)}</bdi>
          {budget > 0 ? ` / ${settings.maxDiskGb} GB` : ` · ${copy.diskUnlimited}`}
        </p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">{copy.secPause}</h3>

        {canReadBattery ? (
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.pauseOnBattery}
              onChange={(event) => onSettings({ ...settings, pauseOnBattery: event.target.checked })}
            />
            <span>
              <span className="name">{copy.pauseBattery}</span>
              <span className="meta">{copy.pauseBatteryHint}</span>
            </span>
          </label>
        ) : null}

        {canReadConnection ? (
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.pauseOnMetered}
              onChange={(event) => onSettings({ ...settings, pauseOnMetered: event.target.checked })}
            />
            <span>
              <span className="name">{copy.pauseMetered}</span>
              <span className="meta">{copy.pauseMeteredHint}</span>
            </span>
          </label>
        ) : null}

        <div className="grid">
          <div className="field">
            <label className="toggle" htmlFor="schedule">
              <input
                id="schedule"
                type="checkbox"
                checked={settings.schedule !== null}
                onChange={(event) =>
                  onSettings({ ...settings, schedule: event.target.checked ? { from: 22, to: 7 } : null })
                }
              />
              <span>
                <span className="name">{copy.schedule}</span>
                <span className="meta">{copy.scheduleHint}</span>
              </span>
            </label>
          </div>

          {settings.schedule ? (
            <>
              <div className="field">
                <label htmlFor="from">{copy.scheduleFrom}</label>
                <input
                  id="from"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.schedule.from}
                  onChange={(event) =>
                    onSettings({
                      ...settings,
                      schedule: { from: Number(event.target.value), to: settings.schedule!.to },
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="to">{copy.scheduleTo}</label>
                <input
                  id="to"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.schedule.to}
                  onChange={(event) =>
                    onSettings({
                      ...settings,
                      schedule: { from: settings.schedule!.from, to: Number(event.target.value) },
                    })
                  }
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">{copy.secSharing}</h3>
        <div className="grid">
          <div className="field">
            <label htmlFor="upload">{copy.upload}</label>
            <input
              id="upload"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={uploadDraft}
              onChange={(event) => onUploadDraft(event.target.value)}
            />
            <small>{copy.uploadHint}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
