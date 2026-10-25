-- Per-profile toolchain (P9): each profile declares the ordered post-processing
-- chain its drafts get — executable gates toggled on/off, prompt-material steps,
-- and the voice-tune master pass. One JSON column, validated in the engine on
-- every read; NULL means the bundled default chain.
--
-- No executable content is stored: only step ids from the built-in set the
-- vendor owns, and markdown checklists capped and control-stripped in
-- `parseToolchain`. `voice-tune` carries the revision-acceptance contract in
-- `compileToolchainPrompt`, so a master-pass rewrite is proposed, not applied.

ALTER TABLE profiles ADD COLUMN toolchain_json TEXT;
