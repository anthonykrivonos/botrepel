/**
 * The contract between BotRepel's servers, the widget, and the SDKs. Types and constants only, no
 * runtime dependencies, so the published SDKs can inline it.
 */

export const DEFAULT_API_ORIGIN = "https://botrepel.com";

/** The form field the widget fills, and the header fetch-based auth clients send the token in. */
export const TOKEN_FIELD = "botrepel-response";
export const TOKEN_HEADER = "x-botrepel-response";

/** Ordered weakest to strongest; a token proves one level and satisfies every level below it. */
export const ASSURANCES = ["invisible", "presence", "liveness"] as const;

export type Assurance = (typeof ASSURANCES)[number];

export function meetsAssurance(proved: Assurance, required: Assurance): boolean {
  return ASSURANCES.indexOf(proved) >= ASSURANCES.indexOf(required);
}

/** `no-camera`: the person chose not to, or can't, use a camera; offer your own fallback. */
export type WidgetErrorCode = "unavailable" | "domain" | "failed" | "step-up-unsupported" | "network" | "no-camera";

/** Every message type is namespaced, so messages from other frames are ignored. */
export type WidgetToHost =
  | { readonly type: "botrepel:ready" }
  | { readonly type: "botrepel:token"; readonly token: string; readonly assurance: Assurance }
  | { readonly type: "botrepel:error"; readonly code: WidgetErrorCode; readonly message: string }
  | { readonly type: "botrepel:expired" }
  /** The flash check needs the whole viewport; the host stretches the iframe while it runs. */
  | { readonly type: "botrepel:expand"; readonly expanded: boolean };

export type HostToWidget = { readonly type: "botrepel:execute" } | { readonly type: "botrepel:reset" };

/** Turnstile-compatible names where they overlap, so switching is a URL change. */
export type SiteverifyErrorCode =
  | "missing-input-secret"
  | "invalid-input-secret"
  | "missing-input-response"
  | "invalid-input-response"
  | "timeout-or-duplicate"
  | "bad-request"
  | "internal-error";

export interface SiteverifyResponse {
  readonly success: boolean;
  /** What the token proved; absent on failure. */
  readonly assurance?: Assurance;
  readonly action?: string;
  readonly hostname?: string;
  /** ISO time the check passed. */
  readonly challenge_ts?: string;
  /** Stable per person and site when a Human Pass was used; never the same across sites. */
  readonly pseudonym?: string | null;
  /** The site's account is out of credit; only the invisible tier was served. */
  readonly unpaid?: boolean;
  readonly risk?: number;
  readonly "error-codes": readonly SiteverifyErrorCode[];
}

/** The widget frame's URL for a site key and options. */
export function widgetUrl(
  apiOrigin: string,
  options: {
    readonly siteKey: string;
    readonly hostOrigin: string;
    readonly action?: string;
    readonly minAssurance?: Assurance;
    readonly theme?: "dark" | "light" | "auto";
    readonly mode?: "auto" | "execute";
  },
): string {
  const url = new URL(`/w/${encodeURIComponent(options.siteKey)}`, apiOrigin);
  url.searchParams.set("origin", options.hostOrigin);
  if (options.action) {
    url.searchParams.set("action", options.action);
  }
  if (options.minAssurance) {
    url.searchParams.set("min", options.minAssurance);
  }
  if (options.theme) {
    url.searchParams.set("theme", options.theme);
  }
  if (options.mode) {
    url.searchParams.set("mode", options.mode);
  }
  return url.toString();
}

/** Whether a message event is from this widget frame: right origin, right window, our namespace. */
export function isWidgetMessage(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  apiOrigin: string,
  frame: Window | null | undefined,
): event is MessageEvent<WidgetToHost> {
  return (
    event.origin === new URL(apiOrigin).origin &&
    frame != null &&
    event.source === frame &&
    typeof event.data === "object" &&
    event.data !== null &&
    typeof (event.data as { type?: unknown }).type === "string" &&
    (event.data as { type: string }).type.startsWith("botrepel:")
  );
}
