# Authentication and the account ring

Two identities exist in this repository and they never meet:

- **The ring** — the listener's account in `apps/web`. It has no server, no
  username, no password and no email. This document is about the ring.
- **The console account** — the operator's login in `apps/admin`: email, password,
  JWT, 2FA, setup token, trusted devices. It is a normal server-side account with
  an audit trail, documented in the console's Help screen and `ADMIN-NODES.md`.

![Sheet 1 — the ring, the relay and the sync contract](auth-and-rings/01-ring-and-sync.png)

*Sheet 1. Every code in the drawing (`K`, `G`, `L`, `X`, `T`) is a table entry;
`[TBD]` means the source does not state a value. The drawing is
[`auth-and-rings/sheet.html`](auth-and-rings/sheet.html) — regenerate the PNGs with
`node render.mjs` in that folder.*

Four sheets describe the ring: **1** the topology and the sync contract, **2** the
ticket and the auth lifecycle, **3** the linking lifecycle state by state, and **4**
what syncs, what stays on the device, and what is public. Rev **B** (2026-10-30)
renamed the local storage namespace and made a pairing end in an observable
success; §4, §6, §7 and §11 are the parts that changed.

## 1. A ring is one keypair

An account is a Gun/SEA keypair generated **on the device**. `pub` is the
identity; `priv` is the only thing that can sign as it. There is no account
record on any server: the relay stores the user's graph, not a user row.

| Code | Field | Lives |
|---|---|---|
| K0 | the pair — `pub`, `priv`, `epub`, `epriv` | `localStorage`, key `tilawah:account` |
| K1 | `pub` | in the graph, in every write's signature |
| K2 | `priv` | the device, and inside a sealed ticket while linking |
| K3/K4 | `epub`/`epriv` | the pairing ticket and the QR, for ≤ T1 |

A device that holds K0 **is** the account. That is why "linking a device" is
copying a key rather than authorising a session — and why the sign-out guard in
§5 exists.

Code: `apps/web/src/hooks/use-gun.ts` (`createAccount`), `gun/account-store.ts`.

## 2. Creating an account

1. `SEA.pair()` generates K0 on the device.
2. `user.auth(pair)` signs in to the relay as that pub.
3. K0 is written to `tilawah:account` (L1).
4. `profile.name` (G1) is written, so other devices can show a ring name rather
   than a pub.

No email, no recovery phrase, no password reset. Lose every device and the ring
is gone; there is nothing to recover it from.

The name is read back by **subscription**, not a one-shot read: `.once()` on a
path the relay has not answered yet may never call back, which is how a fresh
ring used to show a placeholder name indefinitely (`gun/auth.ts`,
`watchRingName`).

## 3. Staying signed in on the same device

Gun's own `recall()` persists to `sessionStorage` only, so closing the browser
would end the account. `startAuthBridge()` therefore reads L1 at boot, calls
`authPair()` with the stored K0, and republishes auth state. If the relay
rejects the pair, L1 is erased rather than retried forever (`gun/auth.ts`).

## 4. Linking a second device

![Sheet 2 — device linking and the auth lifecycle](auth-and-rings/02-linking-and-auth.png)

*Sheet 2. The QR carries K3/K4, never K2 directly.*

![Sheet 3 — the linking lifecycle, state by state, on both devices](auth-and-rings/03-linking-lifecycle.png)

*Sheet 3. Success is a row in the ring, not a message between the devices.*

Six steps, all in `gun/pairing.ts`:

1. **Ticket** — the device that holds K0 generates a throwaway pair K3/K4, and
   records which device ids are already in the ring.
2. **Seal** — K0 is encrypted with `SEA.encrypt(accountPair, ephemeral)`.
3. **Publish** — the sealed blob and an expiry go to
   `open-tilawa-pairing/<id>` on the relay.
4. **Show** — the ticket `{v: 2, id, epub, epriv, exp}` is drawn as a QR, or
   copied as text.
5. **Scan** — the new device reads it with the camera or pastes it, checks `exp`,
   stops the stream, then fetches the envelope and decrypts it with K3/K4.
6. **Burn** — the envelope is deleted whether or not the decrypt succeeded, then
   `authWithPair()` signs in, writes L1 and stamps its own device row.

### What "success" means

Nothing is sent from B to A. B's first act after auth is `touchDevice()`, which
writes `devices/<id>`; A is already subscribed to that node.

- **A closes the QR popup when a device id that was not in the ring when the code
  was drawn appears.** The row is the receipt. A heartbeat from an existing
  device cannot close it, and a code that is never redeemed cannot either.
- **B's confirmation belongs to the sheet**, not to the join panel: the tab
  switch unmounts that panel, and a message rendered there would vanish. The
  banner names the ring, and the new row is marked for eight seconds.
- **T4 = 10 s** bounds the redeem. A relay that never answers is a failure with a
  retry, not a spinner.
- **One ticket, one redemption.** A second decode callback is ignored while the
  first is in flight.

### Rules that fall out of that design

- **T1 = 120 s**, checked on the receiving side and again when the envelope is
  read.
- **Version 1 is refused.** `parseTicket` rejects anything that is not `v: 2`;
  v1 was the account pair in the clear.
- **A device in the ring cannot scan.** It already holds K0, so it is shown the
  code; only a device with no key is offered the scanner
  (`components/account/account-sheet.tsx`).
- **A photograph of the code inside T1 is the account.** The ticket narrows the
  exposure to a short, single-use window; it does not remove it. Encrypting the
  QR itself buys nothing here: the opener would have to be on the same screen.
- **A failed redemption keeps the panel.** The stream is stopped before the
  relay is asked, so the panel names the fault and offers one tap back to the
  camera instead of dropping back to the card.

### The scanner

The viewfinder decodes QR only, at 15 fps, over a box sized to 75 % of the
shorter side, from a 1280×720 ideal stream, without the mirrored-image pass.
Where the browser has the native `BarcodeDetector`, `html5-qrcode` uses it. The
drawn code is 320 px of source with a three-module quiet zone, error correction
M, displayed at 280 px. The payload is deliberately **not** shortened: a receiver
still running the previous bundle could not read it during a rollout.

## 5. Signing out

`clearStoredPair()` erases L1 and `user.leave()` clears the in-memory session.
`leave()` emits no auth event, so the state is republished by hand
(`publishAuthState()`).

Because a ring has no server-side recovery, the last remaining device must type a
confirmation word before it can sign out
(`apps/web/src/components/account/account-sheet.tsx`). With two or more devices,
signing out is one click.

## 6. What syncs

The graph lives inside `gun.user()`. It is **signed, not encrypted** — anyone
holding K1 can read all of it (see §9).

| Code | Path | Written by | Merge rule |
|---|---|---|---|
| G1 | `profile.name` | create, rename | last write |
| G2 | `settings` | any settings change | last-write-wins on `updatedAt` |
| G3 | `favorites/<reciterId>` | favourite toggle | union — never replaces |
| G4 | `devices/<deviceId>` | login, then every T2 = 300 s | merge, per row · carries `linkedAt` |
| G5 | `devices/meta` | first device to register | claim once, never overwritten |
| G6 | `recentlyViewed/<reciterId>` | opening a reciter | newest `at` per id |
| G7 | `schema` | login, on version change | version stamp |

Two of those deserve their design note:

- **Settings are last-write-wins on a stamp, not a merge.** `resolveRemoteSettings`
  compares `updatedAt` so a replayed snapshot cannot undo a choice made while the
  snapshot was in flight. Writes are one whole-object `put`, never a
  read-modify-write (`hooks/use-persistence.ts`, `hooks/use-user-sync.ts`).
- **Favourites are a union of three sources** — the relay, this device's mirror,
  and anything favourited while logged out. A replace would delete the
  logged-out ones.

Reads are snapshot-then-subscribe: `once()` first so a screen does not flash
empty, then `.on()` for changes. Device rows are written locally into the atom at
the same moment as the relay write, because waiting for the echo left a fresh
ring showing "0 devices" for a round trip.

### Why there is no "remove device" button

Removing a row would hide a device; it would not revoke anything. The key in it
*is* the account, and the relay has no access control to enforce a removal. A
cooperative revocation list — write the id, hope the client signs itself out —
cannot bind a client that ignores it, an old cached bundle, or a device that
never opens the app again. True revocation means a new keypair: a new ring, with
every remaining device re-paired. That is a migration, not a button.

So the sheet states the fact instead of implying a guarantee: signing out affects
one device, and the key stays valid everywhere it exists.

### Why the heartbeat is 300 s and visibility-gated

`lastSeen` is a hint. A background tab rewriting its row forever is relay storage
nobody reads, so the timer is five minutes and only fires while the document is
visible.

## 7. What never leaves the device

| Code | Key or source | Holds |
|---|---|---|
| L1 | `tilawah:account` | K0 |
| L2 | `tilawah:v3` | playhead per reciter, settings mirror |
| L3 | `tilawah:favorites` | favourite ids, for logged-out use |
| L4 | `tilawah:recent` | reciter history mirror |
| L5 | `tilawah:device-id`, `tilawah:device-name` | this device's id and label |
| L6 | `tilawah:device-linked-at` | when this device joined, stamped once |
| L7 | `tilawah:telemetry`, `tilawah:telemetry-device-day` | consent, and the one-per-UTC-day device event |
| L8 | `tilawah:anon-id`, `tilawah:counted:*`, `tilawah:viewed:*` | counting identity, and what this browser already counted |

Rev B moved the namespace from `open-tilawa:` to `tilawah:`.
`migrateStorageNamespace()` runs as the first statement in `main.tsx`, before the
locale or theme reads anything, and **copies** each old key to the new name when
the target is absent. The old key is left in place for one release, so a tab still
running the previous bundle keeps its state; the target wins if both exist. The
window event moved with it (`tilawah:settings`), and signing out erases both
copies of the account key.

The **playhead is deliberately absent from the graph**: a second device shows the
same favourites and settings but does not resume where the first stopped.
Cross-device resume was considered and rejected; L2 is the only home for it
(`hooks/use-persistence.ts`).

## 8. What sits outside the ring

Two counters live outside `gun.user()` on purpose: `viewCounts` and
`favoriteCounts`, keyed per reciter and namespaced by environment
(`open-tilawa-<env>-view-counts`). They are anonymous totals — readable by
anyone, writable by anyone.

Those two roots keep the **old** prefix after the rename on purpose: they are
wire identifiers, not local state. Renaming a counter root does not migrate
anything — it starts the totals from zero. The pairing root is the same story in
miniature: a rename would break linking between two builds during the rollout. The user's own list is in G3 and never touches these
nodes. Bumps are serialised per id with a read-modify-write chain, because two
bumps in the same millisecond used to tie on Gun's state clock
(`gun/counts.ts`).

A count is therefore a claim, not a fact. It is a popularity hint that never
gates playback.

## 9. What the relay can see

- **The graph, in plaintext.** Gun user spaces are signed, not encrypted. K1 is
  public by construction, so the relay — and anyone who has the pub — can read
  favourites, history, device names and user agents.
- **The envelope, encrypted but short-lived.** `SEA.encrypt` needs
  `crypto.subtle`, so linking only works on https or localhost. The blob is
  useless without K4, and K4 is only in the QR.
- **The device at rest.** L1 is a plain `localStorage` value: anyone with the
  browser profile has the account, exactly as they would have a signed-in session
  cookie. Signing out erases it.

Encrypting the graph itself is possible — every device in the ring already holds
the same keypair, so `SEA.encrypt` would work — but Gun merges **per field**, and
that is exactly why favourites and settings can be written from two devices
without losing each other. A single encrypted blob would replace the merge with
last-write-wins on the whole bag, and a writer that had not read the newest
ciphertext would erase its sibling's fields. It would also need a secure context
(`crypto.subtle`), and would blind only the relay operator — who is the operator,
and disclosed here. Not done; not planned.

## 10. Where the code lives

| Concern | File |
|---|---|
| Auth bridge, pair auth, ring name | `apps/web/src/gun/auth.ts` |
| Create, sign out, rename, pair | `apps/web/src/hooks/use-gun.ts` |
| Stored keypair (L1) | `apps/web/src/gun/account-store.ts` |
| Ticket format and validation | `apps/web/src/gun/pairing-ticket.ts` |
| Seal, publish, redeem, burn | `apps/web/src/gun/pairing.ts` |
| Relay → atoms, device row, heartbeat | `apps/web/src/hooks/use-user-sync.ts` |
| Storage namespace and migration | `apps/web/src/utils/storage-keys.ts` |
| Join date, relative labels | `utils/device/device-linked-at.ts`, `utils/relative-time.ts` |
| Redemption errors in the listener's language | `utils/pairing-error.ts` |
| Playhead, local mirrors, LWW | `apps/web/src/hooks/use-persistence.ts` |
| Counters | `apps/web/src/gun/counts.ts` |
| Linking and device list UI | `apps/web/src/components/account/` |

## 11. Screens

The four states a link produces, captured from a build against the real relay —
`docs/auth-and-rings/screens.mjs` drives them (two browser contexts, the manual
paste path for the ticket; the camera cannot be driven headless).

| | |
|---|---|
| ![A ring with one device](auth-and-rings/shots/01-ring-created.png) | ![The pairing code popup](auth-and-rings/shots/02-pairing-code.png) |
| **Created.** One device row, «أضيف الآن» from the stamp this device wrote for itself. | **The code.** 280 px, three-module quiet zone, one-time, dies in 120 s. |
| ![B after linking](auth-and-rings/shots/03-this-device-joined.png) | ![A after B joined](auth-and-rings/shots/04-device-added-elsewhere.png) |
| **B, after linking.** The camera never opened here — the same redeem path ran. | **A, once B registers.** The code closed itself, the banner names the device, the row is marked. |

The last shot is the feature in one frame: nobody tapped close. A watched its own
device list, saw an id it had not recorded when the code was drawn, and closed the
popup.

## Open questions

These are `[TBD]` on the drawing because neither the code nor the docs decide
them:

- a bound on the QR payload and the parser's input size;
- a maximum number of devices per ring (nothing enforces one today);
- whether removal ever becomes a key-rotation flow, with everything re-paired.
