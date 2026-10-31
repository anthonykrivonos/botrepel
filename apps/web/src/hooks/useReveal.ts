import { useEffect, useRef, type RefObject } from "react";

/**
 * Fades an element in the first time it scrolls into view. Pre-rendered HTML is always visible;
 * after hydration, only elements still below the fold are hidden, so nothing on screen blinks.
 * With reduced motion nothing is hidden at all.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      element.getBoundingClientRect().top < window.innerHeight ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
