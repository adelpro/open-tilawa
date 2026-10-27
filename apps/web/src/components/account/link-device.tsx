import { useCallback, useEffect, useRef, useState } from 'react';

import { createPairingTicket, encodeTicket, parseTicket, redeemTicket } from '@/gun/pairing';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

const READER_ID = 'tilawa-qr-reader';
const card = 'rounded-xl border border-line p-3';
const action = 'mt-2.5 w-full rounded-xl px-3 py-2 text-[13px] transition-colors';

/** Show a sealed ticket, or scan one. Never renders the account key itself. */
export default function LinkDevice({ onLinked }: { onLinked: () => void }) {
  const { t } = useLocale();
  const copy = t.account;
  const { getPair, authWithPair } = useGun();
  const [qr, setQr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // already stopped
    }
  }, []);

  useEffect(() => () => void stopScanner(), [stopScanner]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setQr(null);
        setExpiresAt(null);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const showTicket = async () => {
    setMessage(null);
    try {
      const pair = getPair();
      if (!pair) throw new Error(copy.signIn);
      const ticket = await createPairingTicket(pair);
      // ~50 kB of QR encoder, only for the one screen that draws a code.
      const { default: QRCode } = await import('qrcode');
      setQr(await QRCode.toDataURL(encodeTicket(ticket), { margin: 1, width: 260 }));
      setExpiresAt(ticket.exp);
    } catch {
      setMessage(copy.codeFailed);
    }
  };

  const startScan = async () => {
    setMessage(null);
    setScanning(true);
    // The element only exists after this render commit.
    await new Promise((r) => setTimeout(r, 0));
    try {
      // The decoder is ~120 kB and only ever runs on this screen.
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        async (text) => {
          const ticket = parseTicket(text);
          if (!ticket) return;
          await stopScanner();
          try {
            const pair = await redeemTicket(ticket);
            const ack = await authWithPair(pair);
            if (ack.err) throw new Error(ack.err);
            setMessage(copy.linked);
            onLinked();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : copy.codeFailed);
          }
        },
        () => {
          // per-frame decode misses are normal, stay quiet
        },
      );
    } catch {
      setScanning(false);
      setMessage(copy.cameraUnavailable);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className={card}>
        <p className="text-[13px] font-medium text-ink">{copy.linkTitle}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{copy.linkNote}</p>
        <button
          type="button"
          onClick={showTicket}
          className={cn(action, 'border border-line text-ink hover:bg-line')}
        >
          {qr ? copy.newCode : copy.showCode}
        </button>
        {qr ? (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <img
              src={qr}
              alt={copy.linkTitle}
              className="rounded-lg bg-white p-2"
              width={260}
              height={260}
            />
            <span className="text-[11.5px] text-muted">{copy.expiresIn(secondsLeft)}</span>
          </div>
        ) : null}
      </div>

      <div className={card}>
        <p className="text-[13px] font-medium text-ink">{copy.scanTitle}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{copy.scanNote}</p>
        <button
          type="button"
          onClick={() => (scanning ? void stopScanner() : void startScan())}
          className={cn(
            action,
            scanning ? 'border border-line text-ink hover:bg-line' : 'bg-ink text-surface',
          )}
        >
          {scanning ? copy.scanStop : copy.scanStart}
        </button>
        <div
          id={READER_ID}
          className={cn('mt-2 overflow-hidden rounded-lg', scanning ? 'block' : 'hidden')}
        />
      </div>

      {message ? <p className="text-[12px] text-muted">{message}</p> : null}
    </div>
  );
}
