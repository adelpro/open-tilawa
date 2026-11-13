/**
 * Keyboard movement for a listbox.
 *
 * Pure, so the walk is testable without a DOM: the component moves focus to the
 * option this returns, and the list never wraps — a list of seven papers has
 * visible ends, and jumping from the last to the first is how a keyboard user
 * loses their place.
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

/** Enter and Space choose the focused option; they never move. */
export function isCommitKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
