/**
 * The mail templates interpolate with `String.replace`, which is not escaping —
 * a seeder's `updateError` is text a stranger's build produced and reaches an
 * HTML mailbox verbatim. Everything that came from the fleet goes through here
 * first.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
