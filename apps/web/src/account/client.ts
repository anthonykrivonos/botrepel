import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient, magicLinkClient } from "better-auth/client/plugins";

/** Written to localStorage on sign-in and sign-out, so other tabs reload with the new session. */
export const SESSION_CHANGED_KEY = "botrepel:session-changed";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the client's type is inferred from its plugins.
const makeClient = () =>
  createAuthClient({
    baseURL: window.location.origin,
    basePath: "/api/auth",
    plugins: [deviceAuthorizationClient(), magicLinkClient()],
  });

let client: ReturnType<typeof makeClient> | undefined;

/** Created on first use, because it needs `window`. */
export function authClient(): ReturnType<typeof makeClient> {
  return (client ??= makeClient());
}

export function announceSessionChange(): void {
  try {
    localStorage.setItem(SESSION_CHANGED_KEY, String(Date.now()));
  } catch {
    // Storage can be blocked; other tabs then refresh on their next request.
  }
}

export async function signOut(): Promise<void> {
  await authClient().signOut();
  announceSessionChange();
  window.location.assign("/");
}

/** A same-site path to return to after sign-in, from `?next=`; anything else goes to the dashboard. */
export function returnPath(search = window.location.search): string {
  const next = new URLSearchParams(search).get("next");
  // A same-site path only: no "//host", no "/\\host" (browsers treat a backslash as a slash), no control characters.
  return next && /^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(next) ? next : "/dashboard";
}

/** Where a failed sign-in returns: the login page, keeping `?next=` so a retry still lands on the right page. */
export function errorPath(search = window.location.search): string {
  const next = returnPath(search);
  return next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
