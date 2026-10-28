import { useState } from 'react';
import { useAtomValue } from 'jotai';

import Sheet from '@/components/sheet';
import DeviceList from '@/components/account/device-list';
import LinkDevice from '@/components/account/link-device';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { userDevicesAtom } from '@/jotai/gun';
import { getOrCreateDeviceName } from '@/utils/device/device-name';
import { cn } from '@/utils/cn';

type Tab = 'devices' | 'add';

const chip = 'rounded-full px-3 py-1.5 text-[12.5px] transition-colors';
const chipOn = 'border-ink bg-ink font-semibold text-invert';
const chipOff = 'border border-line text-ink hover:bg-line';

/**
 * A fixed body height, not `auto`.
 *
 * With `auto` the panel grew and shrank as the tabs changed, so the sheet
 * jumped under the finger on every switch. The height is the tallest common
 * state; anything taller scrolls — except the camera, which fills it.
 */
const BODY = 'h-[min(72dvh,30rem)] px-5 pb-5 pt-3';

/**
 * A ring is one account: the keypair, plus every device that holds a copy of it.
 *
 * A device in a ring can only add another device to *that* ring, so it is shown
 * the pairing code and never the scanner. Scanning is for a device with no key
 * yet, which is joining a ring rather than adding to one.
 */
export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const copy = t.account;
  const { loggedIn, name, loading, error, createAccount, logout } = useGun();
  const devices = useAtomValue(userDevicesAtom) as Record<string, { id?: string }>;
  const [tab, setTab] = useState<Tab>('devices');
  const [confirmText, setConfirmText] = useState('');
  const [camera, setCamera] = useState(false);
  const [ringName, setRingName] = useState(() => getOrCreateDeviceName());

  const deviceCount = Object.values(devices || {}).filter((d) => d?.id).length;
  const isLastDevice = deviceCount <= 1;
  const canSignOut = !isLastDevice || confirmText.trim().toLowerCase() === copy.signOutConfirmWord;

  const close = () => {
    setConfirmText('');
    setCamera(false);
    onClose();
  };

  return (
    <Sheet title={copy.title} open={open} onClose={close} size="auto">
      <div
        className={cn(
          BODY,
          // The camera owns the panel: everything else leaves the flow so the
          // viewfinder sits in the visible area instead of below a fold.
          camera ? 'flex flex-col overflow-hidden' : 'space-y-3 overflow-y-auto overscroll-contain',
        )}
      >
        {loggedIn ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[12.5px] text-muted">
                {copy.ringOf} <span className="text-ink">{name || '—'}</span>
              </p>
              <span className="shrink-0 text-[11.5px] text-muted">
                {copy.deviceCount(deviceCount)}
              </span>
            </div>

            <div className="flex gap-1.5">
              {(
                [
                  ['devices', copy.devices],
                  ['add', copy.addDevice],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={tab === key}
                  className={cn(chip, tab === key ? chipOn : chipOff)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'devices' ? (
              <>
                <DeviceList />
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[13px] font-medium text-ink">{copy.signOutTitle}</p>
                  {isLastDevice ? (
                    <>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-red-500">
                        {copy.signOutLast}
                      </p>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={copy.signOutConfirm}
                        aria-label={copy.signOutConfirm}
                        className="mt-2 w-full rounded-lg border border-line bg-transparent px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ink"
                      />
                    </>
                  ) : (
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                      {copy.signOutSafe}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!canSignOut}
                    onClick={() => {
                      logout();
                      close();
                    }}
                    className={cn(
                      'mt-2.5 w-full rounded-xl border px-3 py-2 text-[13px] transition-colors',
                      canSignOut
                        ? 'border-red-500/40 text-red-500 hover:bg-red-500/10'
                        : 'border-line text-muted opacity-50',
                    )}
                  >
                    {copy.signOutAction}
                  </button>
                </div>
              </>
            ) : (
              <LinkDevice
                mode="share"
                open={open}
                onLinked={() => setTab('devices')}
                onCameraChange={setCamera}
              />
            )}
          </>
        ) : (
          <>
            <div className={cn('rounded-xl border border-line p-3', camera && 'hidden')}>
              <p className="text-[13px] font-medium text-ink">{copy.createTitle}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{copy.createNote}</p>
              <label className="mt-2.5 block">
                <span className="mb-1 block text-[11.5px] text-muted">{copy.ringName}</span>
                <input
                  value={ringName}
                  onChange={(e) => setRingName(e.target.value)}
                  placeholder={copy.ringName}
                  aria-label={copy.ringName}
                  maxLength={40}
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
              </label>
              <button
                type="button"
                disabled={loading || !ringName.trim()}
                onClick={() => void createAccount(ringName)}
                className="mt-2 w-full rounded-xl bg-ink px-3 py-2.5 text-[13.5px] font-medium text-invert disabled:opacity-40"
              >
                {loading ? '…' : copy.createAction}
              </button>
              {error ? <p className="mt-1.5 text-[12px] text-red-500">{error}</p> : null}
            </div>

            <LinkDevice
              mode="scan"
              open={open}
              onCameraChange={setCamera}
              onLinked={() => {
                setCamera(false);
                setTab('devices');
              }}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}
