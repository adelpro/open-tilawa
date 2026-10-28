import { useCallback, useEffect, useRef, useState } from 'react';

import { createPairingTicket, encodeTicket, parseTicket, redeemTicket } from '@/gun/pairing';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

const READER_ID = 'tilawa-qr-reader';
const card = 'rounded-xl border border-line p-3';
const action = 'mt-2.5 w-full rounded-xl px-3 py-2 text-[13px] transition-colors';
const field =
  'w-full rounded-xl border border-line bg-transparent px-3 py-2 text-[13px] text-ink outline-none focus:border-ink';

type Mode = 'share' | 'scan';

/**
 * One half of the ring handshake.
 *
 * `share` shows a sealed ticket for a device that is already in the ring.
 * `scan` is the other side: a device with no key reads a ticket to join. The two
 * are never offered together, because a device that is already in the ring has
 * nothing to scan — it would only be trying to join a second ring.
 *
 * Both halves have a camera-less path. A desktop has no camera to point at a
 * phone, and a phone may refuse the permission, so the ticket can always be
 * copied as text and pasted on the other side.
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
  const [ticketText, setTicketText] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [wantScan, setWantScan] = useState(false);
  const [manual, setManual] = useState(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

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
        setTicketText(null);
        setExpiresAt(null);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const finishJoin = useCallback(
    async (text: string) => {
      const ticket = parseTicket(text);
      if (!ticket) {
        setMessage(copy.manualInvalid);
        return;
      }
      setBusy(true);
      try {
        const pair = await redeemTicket(ticket);
        const ack = await authWithPair(pair);
        if (ack.err) throw new Error(ack.err);
        setMessage(copy.linked);
        onLinked();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : copy.codeFailed);
      } finally {
        setBusy(false);
      }
    },
    [authWithPair, copy, onLinked],
  );

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
            await finishJoin(text);
          },
          () => {
            // per-frame decode misses are normal, stay quiet
          },
        );
      } catch {
        if (!cancelled) {
          setWantScan(false);
          // A device without a camera is not an error state: offer the paste.
          setManual(true);
          setMessage(copy.cameraUnavailable);
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [wantScan, copy, leaveCamera, finishJoin, stopScanner]);

  const showTicket = async () => {
    setMessage(null);
    setCopied(false);
    try {
      const pair = getPair();
      if (!pair) throw new Error(copy.createAction);
      const ticket = await createPairingTicket(pair);
      const text = encodeTicket(ticket);
      // ~50 kB of QR encoder, only for the one screen that draws a code.
      const { default: QRCode } = await import('qrcode');
      setQr(await QRCode.toDataURL(text, { margin: 1, width: 260 }));
      setTicketText(text);
      setExpiresAt(ticket.exp);
    } catch {
      setMessage(copy.codeFailed);
    }
  };

  const copyTicket = async () => {
    if (!ticketText) return;
    try {
      await navigator.clipboard.writeText(ticketText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(copy.copyFailed);
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
        <button
          type="button"
          onClick={() => void leaveCamera().then(() => setManual(true))}
          className="text-center text-[11.5px] text-muted underline underline-offset-2"
        >
          {copy.manualToggle}
        </button>
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
            onClick={() => void showTicket()}
            className={cn(action, 'bg-ink text-invert')}
          >
            {copy.showCode}
          </button>
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
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setManual((v) => !v);
            }}
            className="mt-1.5 w-full rounded-xl px-3 py-2 text-[12.5px] text-muted transition-colors hover:text-ink"
          >
            {copy.manualToggle}
          </button>

          {manual ? (
            <div className="mt-2 space-y-2 border-t border-line pt-2.5">
              <p className="text-[11.5px] leading-relaxed text-muted">{copy.manualNote}</p>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={3}
                dir="ltr"
                placeholder={copy.manualPlaceholder}
                aria-label={copy.manualToggle}
                className={cn(field, 'resize-none font-mono text-[11px]')}
              />
              <button
                type="button"
                disabled={busy || !pasted.trim()}
                onClick={() => void finishJoin(pasted.trim())}
                className={cn(action, 'bg-ink text-invert', 'disabled:opacity-40')}
              >
                {busy ? '…' : copy.manualAction}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {message ? <p className="text-[12px] text-muted">{message}</p> : null}

      {/*
        The code is a popup, not a block inside the sheet: it is the one thing
        the other person has to point a camera at, so it gets the middle of the
        screen at a size a phone camera can read.
      */}
      {qr ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.shareTitle}
          onClick={() => setQr(null)}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[300px] rounded-2xl border border-line bg-canvas p-4 text-center"
          >
            <p className="text-[13px] font-medium text-ink">{copy.shareTitle}</p>
            <img
              src={qr}
              alt={copy.shareTitle}
              width={240}
              height={240}
              className="mx-auto mt-3 rounded-lg bg-white p-2"
            />
            <p className="mt-2 text-[11.5px] text-muted">{copy.expiresIn(secondsLeft)}</p>
            <button
              type="button"
              onClick={() => void copyTicket()}
              className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-[13px] text-ink transition-colors hover:bg-line"
            >
              {copied ? copy.copied : copy.copyCode}
            </button>
            <button
              type="button"
              onClick={() => void showTicket()}
              className="mt-1.5 w-full rounded-xl px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-line"
            >
              {copy.newCode}
            </button>
            <button
              type="button"
              onClick={() => setQr(null)}
              className="mt-1 w-full rounded-xl px-3 py-2 text-[12.5px] text-muted transition-colors hover:text-ink"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
