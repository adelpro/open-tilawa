import { useState } from 'react';

import { useAtomValue } from 'jotai';
import { userDevicesAtom, userDevicesMetaAtom } from '@/jotai/gun';
import { useUserSync } from '@/hooks/use-user-sync';
import { useLocale } from '@/hooks/use-locale';
import { getOrCreateDeviceId } from '@/utils/device/device-id';
import { setDeviceName } from '@/utils/device/device-name';

type Device = {
  id: string;
  name?: string;
  pub?: string;
  lastSeen?: number;
  linkedAt?: number;
  userAgent?: string;
};

export default function DeviceList() {
  const { t } = useLocale();
  const copy = t.account;
  const devices = useAtomValue(userDevicesAtom) as Record<string, Device>;
  const meta = useAtomValue(userDevicesMetaAtom) as { primaryPub?: string };
  const { updateDeviceName } = useUserSync();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const currentId = getOrCreateDeviceId();

  const when = (ts?: number): string => {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    if (diff < 60_000) return copy.justNow;
    if (diff < 3_600_000) return copy.minutesAgo(Math.floor(diff / 60_000));
    if (diff < 86_400_000) return copy.hoursAgo(Math.floor(diff / 3_600_000));
    return new Date(ts).toLocaleDateString();
  };

  const rows = Object.values(devices || {})
    .filter((d): d is Device => Boolean(d?.id))
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  const startRename = (device: Device) => {
    setEditing(device.id);
    setDraft(device.name || '');
  };

  const commitRename = (device: Device) => {
    const next = draft.trim() || 'Device';
    updateDeviceName(device.id, next);
    if (device.id === currentId) setDeviceName(next);
    setEditing(null);
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] leading-relaxed text-muted">{copy.devicesNote}</p>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-[13px] text-muted">{copy.noDevices}</li>
        ) : (
          rows.map((device) => {
            const isThis = device.id === currentId;
            const isPrimary = Boolean(meta?.primaryPub && device.pub === meta.primaryPub);
            return (
              <li key={device.id} className="px-3 py-3">
                {editing === device.id ? (
                  <input
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(device)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(device);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-[13px] text-ink outline-none focus:border-ink"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(device)}
                    className="max-w-full truncate text-start text-[14px] font-medium text-ink"
                    title={copy.devices}
                  >
                    {device.name || 'Device'}
                  </button>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  <span>{copy.lastSeen(when(device.lastSeen))}</span>
                  {isThis ? (
                    <span className="rounded-full bg-line px-1.5 py-0.5 text-[10.5px] text-ink">
                      {copy.thisDevice}
                    </span>
                  ) : null}
                  {isPrimary ? (
                    <span className="rounded-full bg-line px-1.5 py-0.5 text-[10.5px] text-ink">
                      {copy.primary}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
