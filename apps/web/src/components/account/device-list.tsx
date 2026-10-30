import { useState } from 'react';

import { Input } from '@/components/field';

import { useAtomValue } from 'jotai';
import { userDevicesAtom, userDevicesMetaAtom } from '@/jotai/gun';
import { useUserSync } from '@/hooks/use-user-sync';
import { useLocale } from '@/hooks/use-locale';
import { getOrCreateDeviceId } from '@/utils/device/device-id';
import { setDeviceName } from '@/utils/device/device-name';
import { relativeTime } from '@/utils/relative-time';
import { cn } from '@/utils/cn';

type Device = {
  id: string;
  name?: string;
  pub?: string;
  lastSeen?: number;
  linkedAt?: number;
  userAgent?: string;
};

export default function DeviceList({ highlightId }: { highlightId?: string | null }) {
  const { t } = useLocale();
  const copy = t.account;
  const devices = useAtomValue(userDevicesAtom) as Record<string, Device>;
  const meta = useAtomValue(userDevicesMetaAtom) as { primaryPub?: string; primaryDeviceId?: string; createdAt?: number };
  const { updateDeviceName } = useUserSync();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const currentId = getOrCreateDeviceId();

  /** "3 months ago" — the words come from the locale, the unit from here. */
  const ago = (ts?: number): string => {
    if (!ts) return '—';
    const relative = relativeTime(ts);
    return copy.ago(relative.unit, relative.value);
  };

  const exact = (ts?: number): string | undefined =>
    ts ? new Date(ts).toLocaleString() : undefined;

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
    <div className="space-y-3">
      <p className="text-[0.75rem] leading-relaxed text-muted">{copy.devicesNote}</p>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-[0.875rem] text-muted">{copy.noDevices}</li>
        ) : (
          rows.map((device) => {
            const isThis = device.id === currentId;
            const isPrimary = Boolean(meta?.primaryDeviceId && device.id === meta.primaryDeviceId);
            const highlighted = highlightId === device.id;
            return (
              <li
                key={device.id}
                data-highlight={highlighted ? 'true' : undefined}
                className={cn('px-3 py-3 transition-colors', highlighted && 'ring-1 ring-inset ring-ink')}
              >
                {editing === device.id ? (
                  <Input
                    value={draft}
                    autoFocus
                    aria-label={copy.rename}
                    name="device-name"
                    autoComplete="off"
                    maxLength={40}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(device)}
                    onKeyDown={(e) => {
                      // Enter during an IME composition commits the candidate,
                      // not the field. Arabic keyboards do not compose, but a
                      // Japanese or Chinese one does, and this input is shared.
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename(device);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="px-2"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(device)}
                    className="max-w-full truncate text-start text-[0.875rem] font-medium text-ink"
                    title={copy.rename}
                  >
                    {device.name || 'Device'}
                  </button>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-muted">
                  <span title={exact(device.lastSeen)}>
                    {copy.lastSeen(ago(device.lastSeen))}
                  </span>
                  {device.linkedAt ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span title={exact(device.linkedAt)}>{copy.added(ago(device.linkedAt))}</span>
                    </>
                  ) : null}
                </div>
                {isThis || isPrimary ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-muted">
                    {isThis ? (
                      <span className="rounded-full bg-line px-2 py-1 text-[0.75rem] text-ink">
                        {copy.thisDevice}
                      </span>
                    ) : null}
                    {isPrimary ? (
                      <span className="rounded-full bg-line px-2 py-1 text-[0.75rem] text-ink">
                        {copy.primary}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
