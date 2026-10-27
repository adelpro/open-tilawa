import { useCallback, useEffect, useRef, useState } from 'react';

import { createPairingTicket, encodeTicket, parseTicket, redeemTicket } from '@/gun/pairing';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

const READER_ID = 'tilawa-qr-reader';
const card = 'rounded-xl border border-line p-3';
const action = 'mt-2.5 w-full rounded-xl px-3 py-2 text-[13px] transition-colors';

type Mode = 'share' | 'scan';

/**
 * One half of the ring handshake.
 *
 * `share` shows a sealed ticket for a device that is already in the ring.
 * `scan` is the other side: a device with no key reads a ticket to join. The two
 * are never offered together, because a device that is already in the ring has
 * nothing to scan — it would only be trying to join a second ring.
 */
export default function LinkDevice({
  mode,
  onLinked,
  onCameraChange,
}: {
  mode: Mode;
  onLinked: () => void;
  /** Lets the sheet give the viewfinder the whole panel. */
  onCameraChange?: (active: boolean) => void;
}) {
  const { t } = useLocale();
  const copy = t.account;
  const { getPair, authWithPair } = useGun();

  const [qr, setQr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [wantScan, setWantScan] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const aliveRef = useRef(true);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // already stopped
    }
  }, []);

  const leaveCamera = useCallback(async () => {
    await stopScanner();
    setWantScan(false);
  }, [stopScanner]);

  useEffect(() => {
    onCameraChange?.(wantScan);
  }, [wantScan, onCameraChange]);

  useEffect(
    () => () => {
      aliveRef.current = false;
      void stopScanner();
    },
    [stopScanner],
  );

  // The countdown runs on the ticket's own expiry, not on a timer we own.
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

  /**
   * The camera is started from an effect, after the reader element is in the
   * document. Starting it from the click handler raced the render and the video
   * attached to a node that was about to be replaced.
   */
  useEffect(() => {
    if (!wantScan) return;
    let cancelled = false;

    void (async () => {
      try {
        // The decoder is ~120 kB and only ever runs on this screen.
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (text) => {
            const ticket = parseTicket(text);
            if (!ticket) return;
            await leaveCamera();
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
        if (!cancelled) {
          setWantScan(false);
          setMessage(copy.cameraUnavailable);
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [wantScan, copy, leaveCamera, onLinked, authWithPair, stopScanner]);

  const showTicket = async () => {
    setMessage(null);
    try {
      const pair = getPair();
      if (!pair) throw new Error(copy.createAction);
      const ticket = await createPairingTicket(pair);
      // ~50 kB of QR encoder, only for the one screen that draws a code.
      const { default: QRCode } = await import('qrcode');
      setQr(await QRCode.toDataURL(encodeTicket(ticket), { margin: 1, width: 260 }));
      setExpiresAt(ticket.exp);
    } catch {
      setMessage(copy.codeFailed);
    }
  };

  // Camera mode owns the panel: the viewfinder sits in the visible area instead
  // of below a fold the listener has to discover.
  if (wantScan) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink">{copy.scanTitle}</p>
          <button
            type="button"
            onClick={() => void leaveCamera()}
            className="rounded-full border border-line px-3 py-1 text-[12px] text-ink transition-colors hover:bg-line"
          >
            {copy.scanStop}
          </button>
        </div>
        <div
          id={READER_ID}
          className={cn(
            'relative min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-black',
            '[&_video]:h-full [&_video]:w-full [&_video]:object-cover',
          )}
        />
        <p className="text-center text-[11.5px] text-muted">{copy.scanHint}</p>
        {message ? <p className="text-center text-[12px] text-muted">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {mode === 'share' ? (
        <div className={card}>
          <p className="text-[13px] font-medium text-ink">{copy.shareTitle}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{copy.shareNote}</p>
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
                alt={copy.shareTitle}
                className="rounded-lg bg-white p-2"
                width={260}
                height={260}
              />
              <span className="text-[11.5px] text-muted">{copy.expiresIn(secondsLeft)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={card}>
          <p className="text-[13px] font-medium text-ink">{copy.joinTitle}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{copy.joinNote}</p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setWantScan(true);
            }}
            className={cn(action, 'bg-ink text-invert')}
          >
            {copy.scanStart}
          </button>
        </div>
      )}

      {message ? <p className="text-[12px] text-muted">{message}</p> : null}
    </div>
  );
}
