import { TOKEN_FIELD, TOKEN_HEADER } from "@botrepel/protocol";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { fieldOf, REJECTED_MESSAGE, verifyToken, type BotRepelOptions } from "../server/request";

/** Better Auth endpoints checked by default, with the widget `action` each expects. */
export const DEFAULT_ENDPOINTS: Readonly<Record<string, string>> = {
  "/sign-up/email": "signup",
  "/sign-in/email": "login",
  "/sign-in/username": "login",
  "/sign-in/magic-link": "magic-link",
  "/email-otp/send-verification-otp": "email-otp",
  "/request-password-reset": "password-reset",
  "/forget-password": "password-reset",
};

export interface BotRepelPluginOptions extends BotRepelOptions {
  /**
   * Endpoint path → the widget `action` it expects. Merged over DEFAULT_ENDPOINTS; set a path to
   * `null` to stop checking it, or an action to `"*"` to accept a token from any action.
   */
  readonly endpoints?: Readonly<Record<string, string | null>>;
  /**
   * Skip calls made on the server with `auth.api.*` and no incoming request (seed scripts, admin
   * tools). Server actions that pass `headers` still need the token: send it in `x-botrepel-response`.
   */
  readonly trustServerCalls?: boolean;
}

/**
 * Requires a BotRepel token on sign-up, sign-in, magic links, email OTPs, and password resets.
 * Clients send it in the `x-botrepel-response` header (`useBotRepel().headers`) or a
 * `botrepel-response` body field.
 */
export function botrepel(options: BotRepelPluginOptions = {}): BetterAuthPlugin {
  const endpoints = Object.fromEntries(
    Object.entries({ ...DEFAULT_ENDPOINTS, ...options.endpoints }).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );
  return {
    id: "botrepel",
    hooks: {
      before: [
        {
          matcher: (context: { path?: string }) => context.path !== undefined && context.path in endpoints,
          handler: createAuthMiddleware(async (ctx) => {
            if (options.trustServerCalls && !ctx.request) {
              return;
            }
            const action = endpoints[ctx.path]!;
            const token = ctx.headers?.get(TOKEN_HEADER) ?? fieldOf(ctx.body, TOKEN_FIELD);
            const result = await verifyToken(token, {
              ...options,
              expectedAction: action === "*" ? undefined : action,
            });
            if (!result.success) {
              throw new APIError("FORBIDDEN", {
                message: REJECTED_MESSAGE,
                code: "BOTREPEL_FAILED",
                errorCodes: result["error-codes"],
              });
            }
          }),
        },
      ],
    },
  };
}
