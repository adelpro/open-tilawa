# How it works

Eight pictures, one question each. For the exact numbers, ports and env vars, go to
[INFRASTRUCTURE.md](../INFRASTRUCTURE.md) — these pages are only here to make the
shape of the thing obvious.

| # | Page | The question it answers |
|---|---|---|
| 1 | [What runs on the box](01-what-runs.md) | What containers are there, and what does each one do? |
| 2 | [One host, or more?](06-servers-and-links.md) | How do seeder nodes fit in, and who talks to whom? |
| 3 | [Where the files live](03-where-files-live.md) | What survives a rebuild, and what is expensive to lose? |
| 4 | [How the audio gets to you](02-audio-path.md) | Why the server does not carry the audio |
| 5 | [Where your account lives](07-where-accounts-live.md) | What the relay holds, and what it does not protect |
| 6 | [One tap, two counters](08-favourites-and-views.md) | What a favourite and a view each write, and how often |
| 7 | [What the console can touch](04-admin-path.md) | What the admin API is allowed to do |
| 8 | [What is actually public](05-public-names.md) | Four names, two doors, one exception |

If you only read two: **1** and **4**.

## Editing the diagrams

All eight drawings come from one data file, `diagrams.html` — boxes, links and
notes, nothing else. Open it in a browser to see them; the PNGs next to it are
rendered from it.

```bash
# needs playwright; run it from a scratch directory if you don't want node_modules here
node render.mjs
```

The drawings are schematic on purpose: no ports except the two that are published,
no latencies, no IPs. Anything that changes often belongs in
[INFRASTRUCTURE.md](../INFRASTRUCTURE.md), not on a picture.

## Where the docs use them

- [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) opens with 01 and 06 instead of ASCII art.
- [STREAMING.md](../STREAMING.md) opens with 02.
- [GUN_MULTI_DEVICE_SYNC.md](../GUN_MULTI_DEVICE_SYNC.md) opens with 07 and 08.

## Further reading

[AUTH_AND_RINGS.md](../AUTH_AND_RINGS.md) is the engineering version of 07: the
keypair, the pairing ticket, and the table of what syncs and what stays on the
device, drawn as a two-sheet system drawing.
