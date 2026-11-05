/**
 * The folder the node stores and serves a release from. The seeder accepts only
 * letters, digits, `_` and `-`, and the name is visible in `/media/<folder>/`.
 */
export function folderFromRelease(name: string, riwaya: string): string {
  const suffix = riwaya && riwaya !== 'unknown' ? `_${riwaya}` : '';
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return `${base || 'Release'}${suffix.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 80);
}
