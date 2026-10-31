import {
  DEFAULT_API_ORIGIN,
  meetsAssurance,
  type Assurance,
  type SiteverifyErrorCode,
  type SiteverifyResponse,
} from "@botrepel/protocol";

export interface VerifyOptions {
  /** Your secret key (`br_sk_…`). Keep it on the server. */
  readonly secretKey: string;
  /** The token from the widget: the `botrepel-response` form field, or `onVerify`'s argument. */
  readonly token: string | null | undefined;
  /** Fail unless the token was issued for this action. */
  readonly expectedAction?: string;
  /** Fail unless the widget ran on this hostname. */
  readonly expectedHostname?: string;
  /** Fail unless the token proved at least this much, e.g. "presence" for login. */
  readonly minAssurance?: Assurance;
  readonly apiOrigin?: string;
  /** Milliseconds before giving up on BotRepel; the default is 5 seconds. */
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

export type VerifyErrorCode = SiteverifyErrorCode | "action-mismatch" | "hostname-mismatch" | "insufficient-assurance";

export type VerifyResult = Omit<SiteverifyResponse, "error-codes"> & {
  readonly "error-codes": readonly VerifyErrorCode[];
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Redeems a widget token. Each token verifies once, within five minutes. Treat any
 * `success: false` as "not verified"; network failures report `internal-error`.
 */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  if (!options.token) {
    return { success: false, "error-codes": ["missing-input-response"] };
  }
  let result: SiteverifyResponse;
  try {
    const response = await (options.fetch ?? fetch)(
      new URL("/v1/siteverify", options.apiOrigin ?? DEFAULT_API_ORIGIN),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: options.secretKey, response: options.token }),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      },
    );
    result = (await response.json()) as SiteverifyResponse;
  } catch {
    return { success: false, "error-codes": ["internal-error"] };
  }
  if (!result.success) {
    return result;
  }
  const errors: VerifyErrorCode[] = [];
  if (options.expectedAction !== undefined && result.action !== options.expectedAction) {
    errors.push("action-mismatch");
  }
  if (options.expectedHostname !== undefined && result.hostname !== options.expectedHostname.toLowerCase()) {
    errors.push("hostname-mismatch");
  }
  if (options.minAssurance && !(result.assurance && meetsAssurance(result.assurance, options.minAssurance))) {
    errors.push("insufficient-assurance");
  }
  return errors.length ? { ...result, success: false, "error-codes": errors } : result;
}
