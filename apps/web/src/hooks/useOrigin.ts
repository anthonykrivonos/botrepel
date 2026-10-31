import { useSyncExternalStore } from "react";
import { SITE_ORIGIN } from "../shared/constants";

const subscribe = (): (() => void) => () => undefined;

/** The origin serving this page; pre-rendered HTML says the production origin until it hydrates. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => SITE_ORIGIN,
  );
}
