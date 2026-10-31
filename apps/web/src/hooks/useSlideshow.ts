import { useEffect, useRef, useState, type RefObject } from "react";

/** Keeps a full-width scroll-snap slideshow's controls in sync with native scrolling. */
export function useSlideshow(count: number): {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly current: number;
  readonly goTo: (index: number) => void;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) {
      return;
    }
    let frame = 0;
    let width = viewport.clientWidth;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport.clientWidth) {
          const next = Math.max(0, Math.min(count - 1, Math.round(viewport.scrollLeft / viewport.clientWidth)));
          currentRef.current = next;
          setCurrent(next);
        }
      });
    };
    const observer = new ResizeObserver(() => {
      if (viewport.clientWidth !== width) {
        width = viewport.clientWidth;
        viewport.scrollTo({ left: currentRef.current * width, behavior: "instant" });
      }
    });
    viewport.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [count]);

  const goTo = (index: number): void => {
    const viewport = ref.current;
    if (!viewport) {
      return;
    }
    const next = Math.max(0, Math.min(count - 1, index));
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(next - current) > 1;
    viewport.scrollTo({ left: next * viewport.clientWidth, behavior: instant ? "instant" : "smooth" });
  };

  return { ref, current, goTo };
}
