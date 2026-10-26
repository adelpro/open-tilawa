/**
 * The brand mark in the shell, landing nav and footer.
 *
 * It is the تلاوة wordmark from the public site (`public/logo-wordmark.png`,
 * generated from `public/logo.png` by `scripts/make-assets.py`) rather than a
 * drawn glyph: one brand, one artwork. `alt` carries the accessible name, so the
 * lockups can show the wordmark alone.
 */
export function FeatherMark({ className, label = '' }: { className?: string; label?: string }) {
  return (
    <img
      src="/logo-wordmark.png"
      alt={label}
      className={className}
      width={512}
      height={240}
    />
  );
}
