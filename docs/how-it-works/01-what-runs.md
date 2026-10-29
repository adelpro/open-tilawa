# What runs on the box

![What runs on the box](01-what-runs.png)

One machine, two things: a compose project with five jobs, and the relay that
sits beside it.

**In the compose project:**

- **edge** is the only way in. It terminates TLS and proxies to the others.
- **web** serves the player bundle and the catalogue. It does not serve audio.
- **tracker** introduces peers to each other. It keeps no state and can be recreated at any time.
- **seeder** holds the audio files and announces them to the tracker.
- **admin** is three containers, not one: the console page, the API, and a door of its own — it never goes through `edge`.

**Beside it:**

- **gun relay** holds the accounts and the public counters on `:8765`, reached
  through `wss://gun.tilawah.cc/gun`. It is its own container, so
  rebuilding the app never touches the accounts. See
  [Where your account lives](07-where-accounts-live.md).

There is no second machine in this picture; a second machine only shows up when you
add a node (see [One host, or more?](06-servers-and-links.md)).

Exact images, ports and volumes: [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) §1–5, §7.
