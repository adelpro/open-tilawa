import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

import { navigate } from '@/hooks/use-route';
import { toPath, type Parsed } from '@/routes';

/**
 * A link that navigates without reloading the document.
 *
 * A plain `<a href="/about">` would reload, which tears down the `<audio>` element and stops
 * playback — the reason these were hash links before. A plain `href="#/about"` would now be
 * worse: the fragment fires `hashchange`, not `popstate`, and the router would never hear it,
 * so the click would do nothing at all.
 *
 * Modifier clicks are left alone, so "open in a new tab" and "copy link" still work.
 */
export default function Link({
  to,
  children,
  onClick,
  ...rest
}: { to: Parsed; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={toPath(to)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
