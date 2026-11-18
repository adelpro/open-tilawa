/**
 * Ties an asynchronous restore preview to the snapshot the dialog is showing.
 *
 * The count request arrives after the dialog may have been closed and another
 * snapshot opened. Without the name check, the older answer would label its rows
 * with the newer file — evidence for an irreversible action that names the wrong
 * backup. A guard keeps that check in one tested place.
 */
export function createPreviewGuard<T>() {
  let current: string | null = null;
  return {
    begin(name: string): void {
      current = name;
    },
    apply(name: string, value: T): T | null {
      return current === name ? value : null;
    },
    clear(): void {
      current = null;
    },
  };
}
