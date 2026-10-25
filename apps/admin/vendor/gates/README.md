# vendor/gates

Pinned copies of the two deterministic gate engines this service runs. They are
**vendored, not resolved at runtime** — the local `writing-flow` plugin finds them
by searching skill roots on the caller's machine, which a server cannot do, and a
search that silently finds a *different copy* is worse than no search at all.

```
vendor/gates/
  avoid-ai-writing/
    check-style.js        # gate4 — house-style mechanics
    markdown-prose.js     # required by check-style.js; single-file copies are broken
  remove-ai-marks/
    inspect_text.py       # gate5 — invisible unicode / provenance marks (stdlib only)
    common.py             # required by inspect_text.py
    text_unicode.py       # required by inspect_text.py
  VERSION                 # version + sha256 of every file above
```

Rules:

- Both Nest images carry this directory, and the runtime stages install `python3`
  for gate5.
- `check-style.js` is invoked with `--config <the user's house-style.json>`, the
  same way the plugin calls it.
- `inspect_text.py` runs as `python3 -B`: it imports its siblings from its own
  directory, so without `-B` CPython writes `__pycache__/` **into this tree** on
  every call — mutating the artefact `VERSION` pins.
- Exit contract preserved exactly: **0 clean, 1 violation, 2 tool error**. A
  missing or unspawnable script is code 2 with a named cause — never a silent
  pass. Exit 1 *without a parseable report* is also code 2, because a crashed gate
  must not read as a finding.
- `VERSION` records each file's sha256 and the version string of the copy it came
  from, and `doctor` compares both directions — a changed file and an unrecorded
  one. Neither copy on this host carries git metadata, so the hash is the record.

Provenance, the update procedure, and the two traps that cost real time are in
[`docs/GATES.md`](../../docs/GATES.md).
