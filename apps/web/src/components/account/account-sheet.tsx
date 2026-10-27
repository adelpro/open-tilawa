import { useState } from 'react';
import { useAtomValue } from 'jotai';

import Sheet from '@/components/sheet';
import AuthForm from '@/components/account/auth-form';
import DeviceList from '@/components/account/device-list';
import LinkDevice from '@/components/account/link-device';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { userDevicesAtom } from '@/jotai/gun';
import { cn } from '@/utils/cn';

type Tab = 'signin' | 'create' | 'link' | 'devices';

const chip = 'rounded-full px-3 py-1.5 text-[12.5px] transition-colors';
const chipOn = 'bg-ink text-surface';
const chipOff = 'border border-line text-ink hover:bg-line';

export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const copy = t.account;
  const { loggedIn, alias, loading, error, createUser, loginUser, logout } = useGun();
  const devices = useAtomValue(userDevicesAtom) as Record<string, { id?: string }>;
  const [tab, setTab] = useState<Tab>('signin');
  const [confirmText, setConfirmText] = useState('');

  const deviceCount = Object.values(devices || {}).filter((d) => d?.id).length;
  const isLastDevice = deviceCount <= 1;
  const canSignOut = !isLastDevice || confirmText.trim().toLowerCase() === copy.signOutConfirmWord;

  const activeTab: Tab = loggedIn
    ? tab === 'link' || tab === 'devices'
      ? tab
      : 'devices'
    : tab === 'devices'
      ? 'signin'
      : tab;

  const close = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <Sheet title={loggedIn ? copy.title : copy.signIn} open={open} onClose={close} size="auto">
      <div className="space-y-3 px-5 pb-5">
        {loggedIn ? (
          <>
            <p className="text-[12.5px] text-muted">
              {copy.signedInAs} <span className="text-ink">{alias || '—'}</span>
            </p>

            <div className="flex gap-1.5">
              {(
                [
                  ['devices', copy.devices],
                  ['link', copy.link],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={activeTab === key}
                  className={cn(chip, activeTab === key ? chipOn : chipOff)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'devices' ? (
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
              <LinkDevice onLinked={() => setTab('devices')} />
            )}
          </>
        ) : (
          <>
            <div className="flex gap-1.5">
              {(
                [
                  ['signin', copy.signIn],
                  ['create', copy.create],
                  ['link', copy.link],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={activeTab === key}
                  className={cn(chip, activeTab === key ? chipOn : chipOff)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'link' ? (
              <LinkDevice onLinked={() => setTab('devices')} />
            ) : (
              <AuthForm
                mode={activeTab === 'create' ? 'create' : 'login'}
                loading={loading}
                error={error}
                onSubmit={(a, p) => {
                  void (activeTab === 'create' ? createUser(a, p) : loginUser(a, p));
                }}
              />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
