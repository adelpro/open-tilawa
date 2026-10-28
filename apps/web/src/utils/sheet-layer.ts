/**
 * The sheet layer's history entry.
 *
 * A sheet pushes one entry so that Back dismisses it instead of leaving the site.
 * The subtlety is handover: when one sheet closes as another opens (the menu
 * hands over to the account sheet), React runs the closing effect *before* the
 * opening one. Unwinding at that moment pops the entry the arriving sheet has
 * just claimed, and its own `popstate` listener closes it a tick later — a sheet
 * that closes itself, silently.
 *
 * So: the entry belongs to the layer, not to a sheet. It is pushed once, reused
 * by whoever is open, and unwound once, only after the commit has settled.
 */
export type SheetLayerDeps = {
  push: (state: unknown) => void;
  back: () => void;
  state: () => unknown;
  href: () => string;
  schedule: (run: () => void) => void;
};

type Open = { token: string; close: () => void };

export function createSheetLayer(deps: SheetLayerDeps) {
  const open: Open[] = [];
  let here = '';
  let settling = false;

  const ours = () =>
    Boolean((deps.state() as { tilawaSheet?: unknown } | null | undefined)?.tilawaSheet);

  return {
    /** True while the entry on the stack is the sheet layer's. */
    ours,

    acquire(token: string, close: () => void) {
      if (open.length === 0 && !ours()) {
        here = deps.href();
        deps.push({ tilawaSheet: true });
      }
      open.push({ token, close });
    },

    release(token: string) {
      const at = open.findIndex((entry) => entry.token === token);
      if (at >= 0) open.splice(at, 1);
      if (open.length > 0) return;

      // Another sheet may be acquiring in this same commit; decide after it has.
      deps.schedule(() => {
        if (open.length > 0) return;
        if (ours() && deps.href() === here) deps.back();
      });
    },

    /** The browser left the entry: dismiss whatever is on top. */
    popped() {
      if (settling) return;
      settling = true;
      deps.schedule(() => {
        settling = false;
        open[open.length - 1]?.close();
      });
    },
  };
}
