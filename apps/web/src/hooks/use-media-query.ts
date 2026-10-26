import { useEffect, useState } from 'react';

/**
 * Answer a media query in React. Used to render the desk list column only when
 * there is room for it: a `hidden` copy of 114 rows is still 114 rows for screen
 * readers and for anyone testing the phone layout.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
