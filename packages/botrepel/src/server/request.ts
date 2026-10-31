import { TOKEN_FIELD, TOKEN_HEADER, type Assurance } from "@botrepel/protocol";
import { verify, type VerifyResult } from "./verify";

/** Better Auth's built-in captcha plugin sends this; accepted so switching over needs no client change. */
const CAPTCHA_HEADER = "x-captcha-response";

/** What every auth integration takes. */
export interface BotRepelOptions {
  /** Defaults to the BOTREPEL_SECRET_KEY environment variable. */
  readonly secretKey?: string;
  /** Fail unless the widget ran on this hostname. */
  readonly expectedHostname?: string;
  /** Fail unless the token proved at least this much. */
  readonly minAssurance?: Assurance;
  readonly apiOrigin?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

/** Shown to the person when an auth integration refuses a request. */
export const REJECTED_MESSAGE = "Human verification failed. Refresh the page and try again.";

const environment = (): Readonly<Record<string, string | undefined>> =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** Redeems `token` with the options every integration shares. */
export function verifyToken(
  token: string | null | undefined,
  options: BotRepelOptions & { readonly expectedAction?: string },
): Promise<VerifyResult> {
  const secretKey = options.secretKey ?? environment().BOTREPEL_SECRET_KEY;
  if (!secretKey) {
    return Promise.resolve({ success: false, "error-codes": ["missing-input-secret"] });
  }
  return verify({ ...options, secretKey, token });
}

/** A string field of a parsed body, ignoring anything else a client sent there. */
export function fieldOf(body: unknown, name: string): string | null {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The widget token a request carries: the `x-botrepel-response` header, or the `botrepel-response`
 * field of a JSON, URL-encoded, or multipart body. Reads a clone, so the body stays readable.
 */
export async function tokenFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get(TOKEN_HEADER) ?? request.headers.get(CAPTCHA_HEADER);
  if (header) {
    return header;
  }
  if (!request.body) {
    return null;
  }
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  try {
    if (type.startsWith("application/json")) {
      return fieldOf(await request.clone().json(), TOKEN_FIELD);
    }
    if (type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data")) {
      const value = (await request.clone().formData()).get(TOKEN_FIELD);
      return typeof value === "string" && value !== "" ? value : null;
    }
  } catch {
    // An unreadable body carries no token.
  }
  return null;
}

/** Verifies the token `request` carries. Never throws; any `success: false` means "not verified". */
export async function verifyRequest(
  request: Request,
  options: BotRepelOptions & { readonly expectedAction?: string } = {},
): Promise<VerifyResult> {
  return verifyToken(await tokenFromRequest(request), options);
}
