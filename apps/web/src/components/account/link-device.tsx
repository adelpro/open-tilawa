import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';

import { createPairingTicket, encodeTicket, parseTicket, redeemTicket } from '@/gun/pairing';
import { Field, TextArea } from '@/components/field';
import { Spinner } from '@/components/icons';
import { useGun } from '@/hooks/use-gun';
import { useLocale } from '@/hooks/use-locale';
import { userDevicesAtom } from '@/jotai/gun';
import type { Messages } from '@/i18n/messages';
import { classifyCameraError, hasCameraApi, type CameraFault } from '@/utils/camera';
import { pairingErrorCopy } from '@/utils/pairing-error';
import { cn } from '@/utils/cn';

const READER_ID = 'tilawa-qr-reader';
const card = 'rounded-xl border border-line p-3';
const action =
  'mt-3 min-h-11 w-full rounded-lg px-3 py-2 text-[0.875rem] transition-colors disabled:opacity-45';
const quiet = 'min-h-11 w-full rounded-lg px-3 py-2 text-[0.875rem] text-muted transition-colors hover:text-ink';

type Mode = 'share' | 'scan';

/**
 * The camera panel: a live viewfinder, the stated reason it could not open, or
 * the paste field. All three share one panel, so a failure never drops the
 * listener back to the card they came from.
 *
 * The reader stays mounted and is only hidden, because the decoder holds a live
 * `<video>` inside it: unmounting the node under a running scanner leaves the
 * stream on and the camera light lit.
 */
type ScanView = 'camera' | 'paste';

function faultCopy(copy: Messages['account'], fault: CameraFault) {
  switch (fault) {
    case 'blocked':
      return { title: copy.cameraBlockedTitle, note: copy.cameraBlockedNote };
    case 'no-device':
      return { title: copy.cameraNoDeviceTitle, note: copy.cameraNoDeviceNote };
    case 'busy':
      return { title: copy.cameraBusyTitle, note: copy.cameraBusyNote };
    case 'secure':
      return { title: copy.cameraSecureTitle, note: copy.cameraSecureNote };
    default:
      return { title: copy.cameraUnavailable, note: copy.manualNote };
  }
}

/** Only these can end differently on a second try; http and no-camera cannot. */
function retryable(fault: CameraFault) {
  return fault === 'blocked' || fault === 'busy' || fault === 'unknown';
}

/** The paste field, in the card and in the camera panel: same form, two doors. */
function PasteForm({
  copy,
  value,
  onChange,
  onJoin,
  busy,
  autoFocus = false,
}: {
  copy: Messages['account'];
  value: string;
  onChange: (value: string) => void;
  onJoin: () => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onJoin();
      }}
    >
      <p className="text-[0.75rem] leading-relaxed text-muted">{copy.manualNote}</p>
      <Field label={copy.manualToggle}>
        {(id) => (
          <TextArea
            id={id}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            dir="ltr"
            autoFocus={autoFocus}
            placeholder={copy.manualPlaceholder}
            name="pairing-ticket"
            autoComplete="off"
            className="font-mono text-[0.875rem]"
          />
        )}
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-[0.875rem] text-invert disabled:opacity-45"
      >
        {busy ? <Spinner size={16} /> : null}
        {copy.manualAction}
      </button>
    </form>
  );
}

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
  open,
  onLinked,
  onCameraChange,
  onDeviceJoined,
}: {
  mode: Mode;
  /** Closing the sheet must release the camera, not just hide it. */
  open: boolean;
  onLinked: () => void;
  /** Lets the sheet give the viewfinder the whole panel. */
  onCameraChange?: (active: boolean) => void;
  /**
   * Share mode only: a device that was not in the ring when the code was drawn
   * has now registered. The row is the proof, so the sheet closes the code on
   * evidence rather than on a timer or a hope.
   */
  onDeviceJoined?: (device: { id: string; name?: string }) => void;
}) {
  const { t } = useLocale();
  const copy = t.account;
  const { getPair, authWithPair } = useGun();
  // Already live for the sheet: the same map the device list renders.
  const devices = useAtomValue(userDevicesAtom) as Record<string, { id?: string; name?: string }>;

  const [qr, setQr] = useState<string | null>(null);
  const [ticketText, setTicketText] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [scanView, setScanView] = useState<ScanView | null>(null);
  const [fault, setFault] = useState<CameraFault | null>(null);
  const [opening, setOpening] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  /** A ticket was read and the relay is being asked for the envelope. */
  const [joining, setJoining] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const qrCloseRef = useRef<HTMLButtonElement>(null);
  /** Two decode callbacks in flight would redeem the same ticket twice. */
  const joiningRef = useRef(false);
  /** Device ids that already existed when this code was drawn. */
  const knownIds = useRef<string[]>([]);
  const announced = useRef(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    // `stop()` rejects when the scanner never started; the element still needs
    // emptying, or the next start inherits a stale <video>.
    try {
      await scanner.stop();
    } catch {
      // already stopped
    }
    try {
      scanner.clear();
    } catch {
      // the reader is gone
    }
  }, []);

  const leaveCamera = useCallback(async () => {
    // Leave first, stop after: the panel must not wait on the camera hardware.
    setScanView(null);
    setFault(null);
    setOpening(false);
    await stopScanner();
  }, [stopScanner]);

  useEffect(() => {
    onCameraChange?.(scanView !== null);
  }, [scanView, onCameraChange]);

  useEffect(
    () => () => {
      void stopScanner();
    },
    [stopScanner],
  );

  // A sheet dismissed mid-scan used to leave the camera streaming behind a
  // closed dialog.
  useEffect(() => {
    if (!open) void leaveCamera();
  }, [open, leaveCamera]);

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
        return false;
      }
      setBusy(true);
      try {
        const pair = await redeemTicket(ticket);
        const ack = await authWithPair(pair);
        if (ack.err) throw new Error(ack.err);
        // The sheet owns the confirmation: the tab switch below unmounts this
        // panel, so a message printed here would be rendered into nothing.
        setMessage(null);
        onLinked();
        return true;
      } catch (e) {
        setMessage(pairingErrorCopy(e, copy));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [authWithPair, copy, onLinked],
  );

  /**
   * The scanner effect must not depend on `finishJoin`: it is rebuilt whenever
   * the sheet re-renders, and a changed dep would stop the camera mid-scan.
   */
  const finishJoinRef = useRef(finishJoin);
  useEffect(() => {
    finishJoinRef.current = finishJoin;
  }, [finishJoin]);

  // Scrolling, not a toast: the join card sits above the fold, its message does not.
  useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ block: 'nearest' });
  }, [message]);

  /**
   * The camera is started from an effect, after the reader element is in the
   * document. Starting it from the click handler raced the render and the video
   * attached to a node that was about to be replaced.
   */
  useEffect(() => {
    if (scanView !== 'camera' || fault) return;
    let cancelled = false;

    void (async () => {
      // Plain http has no getUserMedia: do not download 120 kB to learn that.
      if (!hasCameraApi(navigator.mediaDevices)) {
        setFault('secure');
        return;
      }
      setOpening(true);
      try {
        // The decoder is ~120 kB and only ever runs on this screen.
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        // Only QR is offered, so the decoder does not try every barcode format
        // on every frame. The native BarcodeDetector path is on by default in
        // 2.3.8 where the browser has it.
        const scanner = new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            // 10 fps at a fixed 220 px box was the old setting: on a phone the
            // box covered half the viewfinder and the code sat outside it.
            fps: 15,
            qrbox: (width: number, height: number) => {
              const side = Math.floor(Math.min(width, height) * 0.75);
              return { width: side, height: side };
            },
            // The stream is not mirrored for an environment camera, so decoding
            // it twice as a flipped image only costs frames.
            disableFlip: true,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          async (text) => {
            const ticket = parseTicket(text);
            if (!ticket || joiningRef.current) return;
            joiningRef.current = true;
            setMessage(null);
            // Camera off first: the light should not stay on while a relay is
            // asked for the envelope. The reader node stays mounted, hidden.
            await stopScanner();
            setJoining(true);
            const ok = await finishJoinRef.current(text);
            setJoining(false);
            joiningRef.current = false;
            if (ok) await leaveCamera();
          },
          () => {
            // per-frame decode misses are normal, stay quiet
          },
        );
        if (!cancelled) setOpening(false);
      } catch (e) {
        if (cancelled) return;
        setOpening(false);
        // Keep the panel: a fault is a state of it, not a way out of it.
        setFault(classifyCameraError(e));
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [scanView, fault, attempt, leaveCamera, stopScanner]);

  const showTicket = async () => {
    setMessage(null);
    setCopied(false);
    // Who is already in the ring: any id that appears after this point was not,
    // and that row is the evidence the pairing worked. No handshake needed.
    knownIds.current = Object.keys(devices).filter(
      (id) => id !== 'meta' && id !== '_' && Boolean(devices[id]?.id),
    );
    announced.current = false;
    try {
      const pair = getPair();
      if (!pair) throw new Error(copy.createAction);
      const ticket = await createPairingTicket(pair);
      const text = encodeTicket(ticket);
      // ~50 kB of QR encoder, only for the one screen that draws a code.
      const { default: QRCode } = await import('qrcode');
      // The spec quiet zone is four modules; `margin: 1` left a code that a
      // camera had to be very close to read. 320 px of source drawn at 280
      // keeps the modules crisp on a phone screen.
      setQr(
        await QRCode.toDataURL(text, {
          errorCorrectionLevel: 'M',
          margin: 3,
          width: 320,
        }),
      );
      setTicketText(text);
      setExpiresAt(ticket.exp);
    } catch {
      setMessage(copy.codeFailed);
    }
  };

  /**
   * The code is closed by the ring, not by a timer: when a device that was not
   * in the map when the code was drawn registers itself, the other person is
   * done, and the popup has no reason to stay.
   */
  useEffect(() => {
    if (!qr || announced.current) return;
    const joined = Object.entries(devices).find(
      ([id, row]) =>
        id !== 'meta' && id !== '_' && Boolean(row?.id) && !knownIds.current.includes(id),
    );
    if (!joined) return;
    announced.current = true;
    setQr(null);
    setTicketText(null);
    setExpiresAt(null);
    onDeviceJoined?.({ id: joined[0], name: joined[1]?.name });
  }, [devices, qr, onDeviceJoined]);

  // The popup is the only thing on screen while it is up: its close button takes
  // focus, and Escape dismisses the code rather than the whole sheet.
  useEffect(() => {
    if (!qr) return;
    qrCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setQr(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [qr]);

  const retryScan = () => {
    setMessage(null);
    setFault(null);
    setJoining(false);
    setScanView('camera');
    setAttempt((n) => n + 1);
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

  // The camera owns the panel: the viewfinder sits in the visible area instead of
  // below a fold the listener has to discover. A failure is shown *in* it, so the
  // layout never jumps out from under the finger.
  if (scanView) {
    const shown = fault ? faultCopy(copy, fault) : null;

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[0.875rem] font-medium text-ink">{copy.scanTitle}</p>
          <button
            type="button"
            onClick={() => void leaveCamera()}
            className="rounded-full border border-line px-3 py-1 text-[0.75rem] text-ink transition-colors hover:bg-line"
          >
            {scanView === 'camera' && !fault && !joining ? copy.scanStop : copy.scanBack}
          </button>
        </div>

        {/*
          Kept mounted and only hidden: the decoder holds a live <video> here, and
          removing the node under it leaves the stream running.
        */}
        <div
          id={READER_ID}
          className={cn(
            'relative min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-black',
            '[&_video]:h-full [&_video]:w-full [&_video]:object-cover',
            scanView !== 'camera' || fault || joining || Boolean(message) ? 'hidden' : undefined,
          )}
        />

        {shown ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-line p-4 text-center">
            <div role="status" className="space-y-2">
              <p className="text-[0.875rem] font-medium text-ink">{shown.title}</p>
              <p className="max-w-[34ch] text-[0.75rem] leading-relaxed text-muted">{shown.note}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFault(null);
                setScanView('paste');
              }}
              className={cn(action, 'bg-ink text-invert')}
            >
              {copy.manualToggle}
            </button>
            {fault && retryable(fault) ? (
              <button
                type="button"
                onClick={() => {
                  setFault(null);
                  setOpening(false);
                  setAttempt((n) => n + 1);
                }}
                className={quiet}
              >
                {copy.cameraRetry}
              </button>
            ) : null}
          </div>
        ) : scanView === 'paste' ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PasteForm
              copy={copy}
              value={pasted}
              onChange={setPasted}
              onJoin={() => void finishJoin(pasted.trim())}
              busy={busy}
              autoFocus
            />
          </div>
        ) : joining ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3"
          >
            <Spinner size={24} />
            <p className="text-[0.875rem] text-ink">{copy.scanJoining}</p>
          </div>
        ) : (
          <>
            <p className="text-center text-[0.75rem] text-muted">
              {opening ? copy.scanOpening : copy.scanHint}
            </p>
            <button
              type="button"
              onClick={() => {
                setFault(null);
                setScanView('paste');
              }}
              className="text-center text-[0.75rem] text-muted underline underline-offset-2"
            >
              {copy.manualToggle}
            </button>
          </>
        )}

        {message ? (
          <div className="space-y-2 text-center">
            <p role="alert" className="text-[0.75rem] text-danger">
              {message}
            </p>
            {scanView === 'camera' && !joining ? (
              <button type="button" onClick={retryScan} className={cn(action, 'bg-ink text-invert')}>
                {copy.scanAgain}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === 'share' ? (
        <div className={card}>
          <p className="text-[0.875rem] font-medium text-ink">{copy.shareTitle}</p>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{copy.shareNote}</p>
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
          <p className="text-[0.875rem] font-medium text-ink">{copy.joinTitle}</p>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{copy.joinNote}</p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setFault(null);
              setScanView('camera');
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
            className="mt-2 w-full rounded-xl px-3 py-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
          >
            {copy.manualToggle}
          </button>

          {manual ? (
            <div className="mt-2 border-t border-line pt-3">
              <PasteForm
                copy={copy}
                value={pasted}
                onChange={setPasted}
                onJoin={() => void finishJoin(pasted.trim())}
                busy={busy}
              />
            </div>
          ) : null}
        </div>
      )}

      {message ? (
        <p ref={messageRef} role="status" aria-live="polite" className="text-[0.75rem] text-muted">
          {message}
        </p>
      ) : null}

      {/*
        The code is a popup, not a block inside the sheet: it is the one thing
        the other person has to point a camera at, so it gets the middle of the
        screen at a size a phone camera can read.
      */}
      {qr ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pairing-code-title"
          aria-describedby="pairing-code-expiry"
          onClick={() => setQr(null)}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-2xl border border-line bg-canvas p-4 text-center"
          >
            <p id="pairing-code-title" className="text-[0.875rem] font-medium text-ink">
              {copy.shareTitle}
            </p>
            <img
              src={qr}
              alt={copy.shareTitle}
              width={280}
              height={280}
              className="mx-auto mt-3 rounded-lg bg-white p-2"
            />
            <p id="pairing-code-expiry" className="mt-2 text-[0.75rem] text-muted">
              {copy.expiresIn(secondsLeft)}
            </p>
            <button
              type="button"
              onClick={() => void copyTicket()}
              className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-[0.875rem] text-ink transition-colors hover:bg-line"
            >
              {copied ? copy.copied : copy.copyCode}
            </button>
            <button
              type="button"
              onClick={() => void showTicket()}
              className="mt-2 w-full rounded-xl px-3 py-2 text-[0.875rem] text-ink transition-colors hover:bg-line"
            >
              {copy.newCode}
            </button>
            <button
              type="button"
              ref={qrCloseRef}
              onClick={() => setQr(null)}
              className="mt-1 w-full rounded-xl px-3 py-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
