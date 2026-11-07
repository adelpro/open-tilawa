/**
 * The four characters that would otherwise close or reopen a tag.
 *
 * Shared by the build's prerenderer and the seed page's static body so the two
 * cannot drift on escaping — a `&&` in a shell command is the common case.
 */
export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
