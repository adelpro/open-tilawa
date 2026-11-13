/**
 * Keyboard movement for the theme listbox. Pure, so the walk is testable (and
 * identical to the player's `utils/listbox.ts`): no wrap, Home/End jump.
 */
export function nextOptionIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const from = Math.min(Math.max(current, 0), last);

  switch (key) {
    case 'ArrowDown':
      return Math.min(from + 1, last);
    case 'ArrowUp':
      return Math.max(from - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

export function isCommitKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
