import { useEffect, useRef } from 'react';

/**
 * Reveals an element the first time it scrolls into view (pair with the `.reveal` or
 * `.reveal-image` class). Content already on screen at load, reduced motion and browsers without
 * IntersectionObserver all skip the effect, so nothing is ever left hidden.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.dataset.reveal = 'hidden';
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          el.dataset.reveal = 'shown';
          observer.disconnect();
        }
      },
      // The root reaches far above the viewport: a jump that carries the element from below the fold
      // to above it (an anchor link, End key) still counts as seen.
      { rootMargin: '100000px 0px -8% 0px' }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      delete el.dataset.reveal;
    };
  }, []);

  return ref;
}
