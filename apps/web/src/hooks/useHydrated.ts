import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => undefined;

/** False in pre-rendered HTML and during hydration, true afterwards: for parts that must render only in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
