export const SITE_NAME = "BotRepel";
export const SITE_DOMAIN = "botrepel.com";

/** Meta name for the home page's public demo site key. The secret is never written here. */
export const DEMO_SITE_KEY_META = "botrepel-demo-site-key";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;

export const UNEXPECTED_ERROR_MESSAGE = "Something went wrong on our side. Try again.";

export const SITE_ORIGIN = `https://${SITE_DOMAIN}`;

/** Where people reach a human: support, privacy requests, and legal notices. */
export const CONTACT_EMAIL = `hello@${SITE_DOMAIN}`;

/** What a founder pastes into their coding agent; the install.md on `origin` tells the agent the rest. */
export const agentPrompt = (origin: string): string =>
  `Add ${SITE_NAME} human verification to this app. Follow ${origin.replace(/\/$/, "")}/install.md`;

/** How long a widget token stays valid for siteverify. */
export const TOKEN_TTL_SECONDS = 300;
