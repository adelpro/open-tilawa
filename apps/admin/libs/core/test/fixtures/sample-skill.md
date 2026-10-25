---
name: parity-sample
description: Sample voice for the parity check
---

I write in short sentences and I mean them.

The point of a paragraph is to carry one idea, and I would rather write two
paragraphs than one that hedges.

I avoid hype, I avoid calls to action, and I do not decorate prose with emoji.

```sh
# a fenced block is dropped whole: it belongs to a pipeline, not to a voice
node scripts/gate.mjs draft.md
```

The pipeline runs purple-cow-content first and then the gates, in stage order,
and exit 0 means clean.

Prefer concrete nouns and active verbs over abstractions and nominalisations.
