# Where your account lives

![Where your account lives](07-where-accounts-live.png)

There is no account server. Your account is a keypair, and the graph behind that
keypair lives on one self-hosted Gun relay:

- `wss://gun.tilawah.cc/gun` → cloudflared → the `gun` container on
  `localhost:8765`.
- The relay is its own container, **not** part of the compose project. Rebuilding
  the app never touches it.
- Two devices signed into the same keypair are the same graph — not two accounts
  that get merged later. Pairing moves the keypair; it does not copy a list.

Two things worth knowing before you touch it:

**Signed, not encrypted.** Gun signs every write, so nobody can forge yours. It
does not encrypt, so anyone with your public key can read the graph. Do not put
anything in it that you would not put in a public repo.

**The counters are not in your graph.** View and favourite totals are separate
public nodes (`open-tilawa-<env>-view-counts`, `-favorite-counts`), readable and
writable by anyone. They are outside the keypair on purpose, so they survive an
account and never leak into a user's private list.

Pairing, recall and the as-built details: [GUN_MULTI_DEVICE_SYNC.md](../GUN_MULTI_DEVICE_SYNC.md).
