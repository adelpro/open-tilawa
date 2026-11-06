import { useEffect, useRef, type RefObject } from 'react';

/**
 * The roster's "load the next page when the end comes into view".
 *
 * Lifted from the picker so the directory and the picker cannot drift: the same
 * 200px margin, the same one-shot observer, the same rule that the caller decides
 * when it is allowed (a search or a filter must not trigger a page behind the
 * results the listener is reading).
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  enabled,
  onLoadMore,
  rootMargin = '200px',
}: {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}): RefObject<T | null> {
  const sentinel = useRef<T | null>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!enabled || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return sentinel;
}
