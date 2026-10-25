# Audit

A condensed procedure, not a skill body. Run the passes in this order and do not
reorder them: each pass assumes the previous one has already removed its own noise.

1. **Style and mechanics — `avoid-ai-writing`.** Rhetorical tics, hedged openings,
   tricolons, "not only… but also", em-dash habits, decorative transitions. Fix by
   deleting, not by substituting a synonym: most violations are padding.
2. **Invisible marks — `remove-ai-marks`.** Zero-width characters, homoglyph
   spaces, tag characters, directional overrides. These survive copy-paste and are
   the reason a "clean" draft can still carry provenance. Remove them silently;
   they are never intentional in prose.
3. **The mechanical contract — `run_gate`.** This is the same gate the product
   serves. `0` clean, `1` violations, `2` the gate could not run.

**Rules that keep the audit honest.**

- Report what the checks report, with the quoted fragment. An opinion without a
  quote is not a finding.
- Fix the smallest span that removes the violation. Whole-paragraph rewrites throw
  away the writer's voice, which is the thing the product exists to keep.
- Never invent a violation to look thorough, and never suppress one to look
  agreeable.
- Channel-specific scrubbers are **out of scope**: a LinkedIn post pass is not a
  general prose pass, and mixing it in changes the house rules mid-audit.

**Output.** Findings grouped by pass, each with the quoted fragment, the rule it
breaks, and the minimal replacement. Then one line: the gate code, and the count of
remaining violations by pass.
