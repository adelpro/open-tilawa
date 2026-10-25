# Fasaha — Arabic register review

A condensed procedure for Arabic prose, not a translation pass. Review the Arabic
that exists; do not re-translate it into English and back.

1. **Name the register.** Modern Standard Arabic, or a deliberate dialect. If the
   profile's language is `ar-MSA`, dialect forms are findings, not flavour —
   except inside quoted speech.
2. **Identifiers stay.** Library, product and file names stay untranslated inline.
   On first use, give the Arabic term followed by the English in parentheses; after
   that, use whichever the surrounding text settled on.
3. **Translationese.** Watch for the shapes that come from English word order:
   passive chains, "تم" constructions where a plain verb works, calqued
   prepositions, pronouns that point at nothing because English needed them and
   Arabic does not.
4. **Orthography.** Hamza forms, ta marbuta versus ha, tanwin, the alif in
   demonstratives, and digits used consistently with the profile. One decision per
   document, applied everywhere.
5. **Punctuation and direction.** Arabic comma and question mark in Arabic prose;
   Latin punctuation inside Latin fragments. Numbers and Latin runs sit correctly
   inside right-to-left text without a manual direction mark.
6. **Do not modernise on purpose-built prose.** A classical or deliberately formal
   register is a choice; only correct it when the register is inconsistent with
   itself.

**Output.** One finding per line: the quoted fragment, what is wrong (register,
orthography, calque, punctuation), and the minimal replacement. Then a verdict —
consistent, or the count of findings by category. Never return a rewritten
document without the findings that justify it.
