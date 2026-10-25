-- P4: a profile needs somewhere to keep its own prose.
--
-- `voice_card_md` holds the rendered, paste-anywhere card; it is not the voice,
-- and re-deriving a card from a card would drift. `generate_profile` produces a
-- SKILL.md, so that is what is stored, and `render_profile` renders from it.
--
-- Additive and nullable: existing rows (including the bundled default, which
-- ships no SKILL.md) stay valid and render with a warning rather than failing.

ALTER TABLE profiles ADD COLUMN skill_md TEXT;
