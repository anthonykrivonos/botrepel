import { TOKEN_FIELD } from "@botrepel/protocol";
import { fieldOf, verifyRequest, verifyToken, type BotRepelOptions } from "./server/request";
import type { VerifyResult } from "./server/verify";

/** A route handler, as Auth.js v5 `handlers` and the v4 App Router `NextAuth(options)` return. */
type RouteHandler = (request: Request, context?: unknown) => Promise<Response> | Response;

export interface WithBotRepelOptions extends BotRepelOptions {
  /** The widget `action` sign-in with the Credentials provider expects. Default "login". */
  readonly credentialsAction?: string;
  /** Email (magic link) provider ids, and the action they expect. Default resend, nodemailer, email, sendgrid, postmark: "magic-link". */
  readonly emailProviders?: readonly string[];
  readonly emailAction?: string;
  /** Where a refused sign-in lands; Auth.js shows it as `error=BotRepel`. Default: Auth.js's own error page. */
  readonly errorPage?: string;
}

const DEFAULT_EMAIL_PROVIDERS = ["resend", "nodemailer", "email", "sendgrid", "postmark", "http-email"];

/** The action a sign-in POST needs, or null for one that isn't checked (OAuth, sign-out, CSRF). */
function actionFor(pathname: string, options: WithBotRepelOptions): string | null {
  const match = /\/(callback|signin)\/([^/]+)$/.exec(pathname);
  if (!match) {
    return null;
  }
  const [, kind, provider] = match;
  if (provider === "credentials" && kind === "callback") {
    return options.credentialsAction ?? "login";
  }
  if (kind === "signin" && (options.emailProviders ?? DEFAULT_EMAIL_PROVIDERS).includes(provider!)) {
    return options.emailAction ?? "magic-link";
  }
  return null;
}

/** Answers the way Auth.js would for a failed sign-in, so `signIn()` resolves with `error: "BotRepel"`. */
async function refused(request: Request, pathname: string, options: WithBotRepelOptions): Promise<Response> {
  const base = pathname.replace(/\/(callback|signin)\/[^/]+$/, "");
  const target = new URL(options.errorPage ?? `${base}/error`, request.url);
  target.searchParams.set("error", "BotRepel");
  // next-auth/react asks for JSON: v5 with this header, v4 with `json=true` in the body.
  const wantsJson =
    request.headers.get("x-auth-return-redirect") === "1" ||
    (await request
      .clone()
      .formData()
      .then((form) => form.get("json") === "true")
      .catch(() => false));
  return wantsJson ? Response.json({ url: target.href }, { status: 403 }) : Response.redirect(target.href, 303);
}

/**
 * Wraps Auth.js route handlers so Credentials and email (magic link) sign-ins need a BotRepel
 * token. OAuth sign-ins pass through: the provider does its own checks.
 *
 *   export const { GET, POST } = withBotRepel(handlers);
 */
export function withBotRepel<H extends { GET: RouteHandler; POST: RouteHandler }>(
  handlers: H,
  options: WithBotRepelOptions = {},
): H {
  const POST: RouteHandler = async (request, context) => {
    const { pathname } = new URL(request.url);
    const action = actionFor(pathname, options);
    if (action !== null) {
      const result = await verifyRequest(request, { ...options, expectedAction: action });
      if (!result.success) {
        return refused(request, pathname, options);
      }
    }
    return handlers.POST(request, context);
  };
  return { ...handlers, POST };
}

/**
 * For a Credentials `authorize` without the route wrapper: verifies the `botrepel-response` field.
 * Use one or the other, since a token verifies only once.
 */
export function verifyCredentials(
  credentials: unknown,
  options: BotRepelOptions & { readonly expectedAction?: string } = {},
): Promise<VerifyResult> {
  return verifyToken(fieldOf(credentials, TOKEN_FIELD), { expectedAction: "login", ...options });
}
