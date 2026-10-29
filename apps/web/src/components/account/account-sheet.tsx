import { useState } from 'react';
import { useAtomValue } from 'jotai';

import Sheet from '@/components/sheet';
import Icon, { Spinner } from '@/components/icons';
import { Field, Input } from '@/components/field';
import DeviceList from '@/components/account/device-list';
import LinkDevice from '@/components/account/link-device';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { userDevicesAtom } from '@/jotai/gun';
import { getOrCreateDeviceName } from '@/utils/device/device-name';
import { cn } from '@/utils/cn';

type Tab = 'devices' | 'add';

const chip = 'rounded-full px-3 py-2 text-[0.875rem] transition-colors';
const chipOn = 'border-ink bg-ink font-semibold text-invert';
const chipOff = 'border border-line text-ink hover:bg-line';

/**
 * A fixed body height, not `auto`.
 *
 * With `auto` the panel grew and shrank as the tabs changed, so the sheet
 * jumped under the finger on every switch. The height is the tallest common
 * state; anything taller scrolls — except the camera, which fills it.
 */
const BODY = 'h-[min(72dvh,30rem)] px-4 pb-4 pt-3';

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
  const { loggedIn, name, loading, error, createAccount, renameAccount, logout } = useGun();
  const devices = useAtomValue(userDevicesAtom) as Record<string, { id?: string }>;
  const [tab, setTab] = useState<Tab>('devices');
  const [confirmText, setConfirmText] = useState('');
  const [camera, setCamera] = useState(false);
  const [ringName, setRingName] = useState(() => getOrCreateDeviceName());
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const deviceCount = Object.values(devices || {}).filter((d) => d?.id).length;
  const isLastDevice = deviceCount <= 1;
  const canSignOut = !isLastDevice || confirmText.trim().toLowerCase() === copy.signOutConfirmWord;

  const close = () => {
    setConfirmText('');
    setCamera(false);
    setEditingName(false);
    onClose();
  };

  const startRenaming = () => {
    setDraftName(name ?? '');
    setEditingName(true);
  };

  const saveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    renameAccount(trimmed);
    setEditingName(false);
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
              {editingName ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2 self-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName();
                  }}
                >
                  <Input
                    autoFocus
                    required
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={copy.ringName}
                    aria-label={copy.ringName}
                    name="ring-name"
                    autoComplete="off"
                    maxLength={40}
                    className="min-w-0 flex-1 px-2"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-ink px-2 py-1 text-[0.75rem] font-medium text-ink"
                  >
                    {copy.renameSave}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    className="shrink-0 px-1 py-1 text-[0.75rem] text-muted"
                  >
                    {copy.renameCancel}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={startRenaming}
                  title={copy.rename}
                  className="group flex min-w-0 items-center gap-2 text-[0.875rem] text-muted hover:text-ink"
                >
                  <span className="shrink-0">{copy.ringOf}</span>
                  <span className="truncate text-ink">{name || '…'}</span>
                  <Icon
                    name="edit"
                    className="shrink-0 opacity-40 group-hover:opacity-100"
                  />
                </button>
              )}
              <span className="shrink-0 text-[0.75rem] text-muted">
                {copy.deviceCount(deviceCount)}
              </span>
            </div>

            <div className="flex gap-2">
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
                  <p className="text-[0.875rem] font-medium text-ink">{copy.signOutTitle}</p>
                  {isLastDevice ? (
                    <>
                      <p className="mt-1 text-[0.75rem] leading-relaxed text-danger">
                        {copy.signOutLast}
                      </p>
                      <div className="mt-2">
                        <Field label={copy.signOutConfirm}>
                          {(id) => (
                            <Input
                              id={id}
                              value={confirmText}
                              onChange={(e) => setConfirmText(e.target.value)}
                              name="sign-out-confirm"
                              autoComplete="off"
                            />
                          )}
                        </Field>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
                      {copy.signOutSafe}
                    </p>
                  )}
                  {/* Disabled here is an interlock, not validation: the button is
                      the irreversible verb and the word is the safety. */}
                  <button
                    type="button"
                    disabled={!canSignOut}
                    onClick={() => {
                      logout();
                      close();
                    }}
                    className={cn(
                      'mt-3 min-h-11 w-full rounded-lg border px-3 py-2 text-[0.875rem] transition-colors',
                      canSignOut
                        ? 'border-danger/40 text-danger hover:bg-danger/10'
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
            <form
              className={cn('rounded-xl border border-line p-3', camera && 'hidden')}
              onSubmit={(event) => {
                event.preventDefault();
                if (ringName.trim()) void createAccount(ringName);
              }}
            >
              <p className="text-[0.875rem] font-medium text-ink">{copy.createTitle}</p>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{copy.createNote}</p>
              <div className="mt-3">
                <Field label={copy.ringName}>
                  {(id) => (
                    <Input
                      id={id}
                      required
                      value={ringName}
                      onChange={(e) => setRingName(e.target.value)}
                      name="ring-name"
                      autoComplete="off"
                      maxLength={40}
                    />
                  )}
                </Field>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-[0.875rem] font-medium text-invert disabled:opacity-45"
              >
                {loading ? <Spinner size={16} /> : null}
                {copy.createAction}
              </button>
              {error ? (
                <p role="alert" className="mt-2 text-[0.75rem] text-danger">
                  {error}
                </p>
              ) : null}
            </form>

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
