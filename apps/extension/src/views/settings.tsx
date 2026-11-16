/**
 * The settings view: four decisions about someone else's machine.
 *
 * The two pause rules are rendered only when the browser can measure the thing
 * they pause on — a toggle that silently does nothing is worse than no toggle.
 * The upload field keeps the raw string; parsing happens on save, so `0` means
 * "do not upload" instead of turning into the default.
 */

import type { Settings } from '@/lib/settings';
import type { Copy } from '@/lib/i18n';

export function SettingsView({
  copy,
  settings,
  uploadDraft,
  canReadBattery,
  canReadConnection,
  onSettings,
  onUploadDraft,
}: {
  copy: Copy;
  settings: Settings;
  uploadDraft: string;
  canReadBattery: boolean;
  canReadConnection: boolean;
  onSettings: (next: Settings) => void;
  onUploadDraft: (value: string) => void;
}) {
  return (
    <section id="settings" className="screen" aria-labelledby="settings-title">
      <h2 id="settings-title">{copy.settings}</h2>

      <div className="grid">
        <div className="field">
          <label htmlFor="mode">{copy.modeLabel}</label>
          <select
            id="mode"
            value={settings.mode}
            onChange={(event) => onSettings({ ...settings, mode: event.target.value as Settings['mode'] })}
          >
            <option value="manual">{copy.modeManual}</option>
            <option value="follow">{copy.modeFollow}</option>
            <option value="mixed">{copy.modeMixed}</option>
          </select>
          <small>{copy.modeHint}</small>
        </div>

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
    </section>
  );
}
