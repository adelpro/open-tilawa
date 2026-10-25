# Write

A condensed procedure, not a skill body. Apply it in order; each step has a stop
condition.

1. **Read the profile state attached below.** If it names required skills, apply
   them in the order given. If it is empty, use the house style and say so.
2. **Draft in the voice, not the vocabulary.** Match sentence length, how
   sentences open, how ideas connect, where the writer pauses. Word choice is the
   weakest signal: two writers can share every word and sound nothing alike.
3. **Language and register.** Use the language the request asks for. If it asks
   for neither, use the profile's first listed language and keep its register —
   Modern Standard Arabic is not a style choice to relax into dialect.
4. **Run the gate before handing anything back.** Call `run_gate` with the draft.
   A draft that has not been through the gate is unfinished, not fast.
5. **Read the gate result as a contract, not a score.** `0` clean, `1` violations
   listed line by line, `2` the gate could not run. At `1`, fix exactly the named
   fragments and re-run. At `2`, report the failure — never claim a pass you did
   not get.
6. **Match the requested length.** One paragraph asked for is one paragraph
   returned. Do not add an introduction, a summary or a closing offer.

**Stop conditions.** The gate returns `0`, or three passes have not cleared it — then
return the best draft with the remaining violations listed, and say which ones.
