import type { DBAdapter } from "better-auth";
import { sha256, type Sql } from "./db";
import { newToken } from "./keys";
import { asBoolean, asDate, fromRiskMilli, toRiskMilli, type TokenRecord } from "./records";
import type { Assurance } from "../src/shared/assurance";
import { TOKEN_TTL_SECONDS } from "../src/shared/constants";

/** How long the customer's backend has to verify a token, as Turnstile allows. */
export const TOKEN_TTL_MS = TOKEN_TTL_SECONDS * 1000;

export interface MintInput {
  readonly siteId: string;
  readonly action: string;
  readonly hostname: string;
  readonly assurance: Assurance;
  readonly risk: number;
  readonly unpaid: boolean;
  readonly pseudonym?: string | null;
  readonly passId?: string | null;
}

export async function mintToken(adapter: DBAdapter, input: MintInput, now = Date.now()): Promise<string> {
  const { token, hash } = newToken();
  await adapter.create({
    model: "verificationToken",
    data: {
      tokenHash: hash,
      siteId: input.siteId,
      action: input.action,
      hostname: input.hostname,
      assurance: input.assurance,
      riskMilli: toRiskMilli(input.risk),
      unpaid: input.unpaid,
      pseudonym: input.pseudonym ?? null,
      passId: input.passId ?? null,
      createdAt: new Date(now),
      expiresAt: new Date(now + TOKEN_TTL_MS),
      redeemedAt: null,
    },
  });
  return token;
}

/**
 * Marks the token used and returns it, atomically: two concurrent verifications of one token
 * can't both succeed. Null for unknown, expired, already used, or another site's tokens.
 */
export async function redeemToken(
  sql: Sql,
  token: string,
  siteId: string,
  now = Date.now(),
): Promise<TokenRecord | null> {
  // Only the token's own site can redeem it, so another site's secret can't burn it.
  const [row] = await sql.all<Record<string, unknown>>(
    `UPDATE "verificationToken" SET "redeemedAt" = ?
     WHERE "tokenHash" = ? AND "siteId" = ? AND "redeemedAt" IS NULL AND "expiresAt" > ?
     RETURNING *`,
    [new Date(now).toISOString(), sha256(token), siteId, new Date(now).toISOString()],
  );
  if (!row) {
    return null;
  }
  return {
    ...(row as unknown as TokenRecord),
    risk: fromRiskMilli(row),
    unpaid: asBoolean(row.unpaid),
    createdAt: asDate(row.createdAt)!,
    expiresAt: asDate(row.expiresAt)!,
    redeemedAt: asDate(row.redeemedAt),
  };
}

/** Whether a token exists for some other site: for a precise error after a failed redeem. */
export async function belongsToAnotherSite(sql: Sql, token: string, siteId: string): Promise<boolean> {
  const [row] = await sql.all<{ siteId: string }>(`SELECT "siteId" FROM "verificationToken" WHERE "tokenHash" = ?`, [
    sha256(token),
  ]);
  return Boolean(row && row.siteId !== siteId);
}
