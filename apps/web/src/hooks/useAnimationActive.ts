import { useEffect, useState, type RefObject } from "react";

/** Run decorative motion only while its section is visible and the visitor allows it. */
export function useAnimationActive(ref: RefObject<Element | null>): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = false;
    const update = (): void => {
      setActive(intersecting && document.visibilityState === "visible" && !reducedMotion.matches);
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false;
      update();
    });

    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, [ref]);

  return active;
}
