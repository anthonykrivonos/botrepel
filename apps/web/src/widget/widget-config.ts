import { ASSURANCES, type Assurance } from "../shared/assurance";

export type Theme = "dark" | "light" | "auto";

export interface WidgetConfig {
  readonly siteKey: string;
  readonly action: string;
  readonly minAssurance: Assurance | undefined;
  /** The embedding page's origin, from the SDK; frame-ancestors already limits who can embed us. */
  readonly hostOrigin: string;
  readonly theme: Theme;
  /** `auto` checks on load; `execute` waits for the host to ask. */
  readonly mode: "auto" | "execute";
}

export function readConfig(location: Location = window.location): WidgetConfig | null {
  const siteKey = location.pathname.match(/^\/w\/(br_pk_[A-Za-z0-9]{16})$/)?.[1];
  const params = new URLSearchParams(location.search);
  let hostOrigin: string;
  try {
    hostOrigin = new URL(params.get("origin") ?? "").origin;
  } catch {
    return null;
  }
  if (!siteKey || hostOrigin === "null") {
    return null;
  }
  const min = params.get("min");
  const theme = params.get("theme");
  return {
    siteKey,
    action: params.get("action") || "*",
    minAssurance: ASSURANCES.includes(min as Assurance) ? (min as Assurance) : undefined,
    hostOrigin,
    theme: theme === "light" || theme === "dark" ? theme : "auto",
    mode: params.get("mode") === "execute" ? "execute" : "auto",
  };
}
