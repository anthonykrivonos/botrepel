import { DEFAULT_API_ORIGIN, TOKEN_FIELD } from "@botrepel/protocol";
import { fieldOf, REJECTED_MESSAGE, verifyToken, type BotRepelOptions } from "./server/request";
import type { VerifyResult } from "./server/verify";

/** Universal Login only posts custom fields whose names start with `ulp-`. */
export const AUTH0_FIELD = `ulp-${TOKEN_FIELD}`;

/** The parts of an Auth0 Action event this reads. */
interface Auth0Event {
  readonly secrets?: Readonly<Record<string, string | undefined>>;
  readonly connection?: { readonly strategy?: string };
  readonly request?: { readonly method?: string; readonly body?: unknown };
  readonly transaction?: { readonly protocol?: string; readonly prompt?: readonly string[] };
}

interface Auth0Api {
  readonly access: { deny(reason: string, userMessage?: string): unknown };
}

/** Connections whose credentials are typed into Universal Login, where the partial adds the widget. */
const FORM_STRATEGIES = new Set(["auth0", "email", "sms"]);

function verifyEvent(event: Auth0Event, options: BotRepelOptions & { expectedAction: string }): Promise<VerifyResult> {
  return verifyToken(fieldOf(event.request?.body, AUTH0_FIELD), {
    ...options,
    secretKey: options.secretKey ?? event.secrets?.BOTREPEL_SECRET_KEY,
  });
}

/**
 * For a Pre User Registration Action: refuses database sign-ups without a passing token.
 *
 *   exports.onExecutePreUserRegistration = (event, api) => botrepelPreUserRegistration(event, api);
 */
export async function botrepelPreUserRegistration(
  event: Auth0Event,
  api: Auth0Api,
  options: BotRepelOptions & { readonly expectedAction?: string } = {},
): Promise<void> {
  const result = await verifyEvent(event, { expectedAction: "signup", ...options });
  if (!result.success) {
    api.access.deny("botrepel_failed", REJECTED_MESSAGE);
  }
}

/**
 * For a Post Login Action: refuses password and passwordless logins submitted without a passing
 * token. Social logins, existing sessions, silent authentication, and refresh tokens pass through:
 * there is no Universal Login form to carry a token.
 */
export async function botrepelPostLogin(
  event: Auth0Event,
  api: Auth0Api,
  options: BotRepelOptions & { readonly expectedAction?: string } = {},
): Promise<void> {
  const interactive =
    FORM_STRATEGIES.has(event.connection?.strategy ?? "") &&
    event.request?.method === "POST" &&
    event.transaction?.protocol !== "oauth2-refresh-token" &&
    !event.transaction?.prompt?.includes("none");
  if (!interactive) {
    return;
  }
  const result = await verifyEvent(event, { expectedAction: "login", ...options });
  if (!result.success) {
    api.access.deny(REJECTED_MESSAGE);
  }
}

export interface Auth0PartialOptions {
  /** Your public site key (`br_pk_…`). */
  readonly siteKey: string;
  /** Your Universal Login custom domain, e.g. https://login.example.com; list it on the site too. */
  readonly loginOrigin: string;
  readonly action: string;
  readonly apiOrigin?: string;
}

const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/**
 * HTML for a Universal Login prompt partial (`form-content-end`): the widget and a hidden field
 * the Action reads. Set it with the Auth0 CLI: `auth0 ul customize` or the prompts partials API.
 */
export function auth0PartialHtml(options: Auth0PartialOptions): string {
  const apiOrigin = new URL(options.apiOrigin ?? DEFAULT_API_ORIGIN).origin;
  const src = new URL(`/w/${encodeURIComponent(options.siteKey)}`, apiOrigin);
  src.searchParams.set("origin", new URL(options.loginOrigin).origin);
  src.searchParams.set("action", options.action);
  return `<input type="hidden" name="${AUTH0_FIELD}" id="${AUTH0_FIELD}">
<iframe id="botrepel" title="BotRepel human verification" src="${escapeAttribute(src.href)}"
  allow="camera; publickey-credentials-get; publickey-credentials-create"
  style="width:300px;height:64px;border:0;display:block"></iframe>
<script>
  // The widget's messages, checked by origin and frame as the React component does.
  addEventListener("message", function (event) {
    var frame = document.getElementById("botrepel");
    if (event.origin !== ${JSON.stringify(apiOrigin)} || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    if (data.type === "botrepel:token") document.getElementById(${JSON.stringify(AUTH0_FIELD)}).value = data.token;
    if (data.type === "botrepel:expired" || data.type === "botrepel:error") document.getElementById(${JSON.stringify(AUTH0_FIELD)}).value = "";
    if (data.type === "botrepel:expand") frame.style.cssText = data.expanded
      ? "position:fixed;inset:0;width:100vw;height:100dvh;border:0;z-index:2147483647"
      : "width:300px;height:64px;border:0;display:block";
  });
</script>`;
}
