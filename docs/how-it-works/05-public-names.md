# What is actually public

![What is actually public](05-public-names.png)

Four names, two doors.

| Name | Goes to |
|---|---|
| `tilawa.quran.us.kg` | `edge` → `web` |
| `tracker.quran.us.kg` | `edge` → `tracker`, websockets |
| `admin-tilawa.quran.us.kg` | the admin door |
| `turn.quran.us.kg` | coturn, directly |

Only two doors are reachable from the internet, and both are published on the host
loopback: `8084` for `edge`, `9400` for the admin door. Everything else binds to
loopback or the compose network and is reached through one of those two doors —
`8083` by `edge`, `8085` by the console. Adding a public surface means adding a
tunnel, not opening a port.

`turn` is the deliberate exception: it is a **direct grey-cloud A record** pointing
at coturn, not a tunnel CNAME. TURN needs UDP, and Cloudflare's proxy does not carry
it. It relays WebRTC between listeners; it is not a tracker and never appears in a
magnet.

> `INFRASTRUCTURE.md` §4 still says TURN's TCP arrives through the tunnel. The DNS
> says otherwise — the drawing follows the DNS.

Details: [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) §4, §7.
