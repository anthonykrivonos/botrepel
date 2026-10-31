import type { DBAdapter } from "better-auth";
import { notifyBalance } from "./billing-notify";
import type { Sql } from "./db";
import { withSqlTransaction } from "./db";
import type { SendEmail } from "./email";
import { chargeWithin, type chargeVerification } from "./ledger";
import type { TokenRecord } from "./records";
import { siteBySecret } from "./sites";
import { belongsToAnotherSite, redeemToken } from "./tokens";
import { SECRET_KEY_PREFIX, TOKEN_PREFIX } from "../src/shared/site";
import type { SiteverifyErrorCode, SiteverifyResponse } from "../src/shared/siteverify";

type Database = Parameters<typeof chargeVerification>[0];

export interface SiteverifyDeps {
  readonly adapter: DBAdapter;
  readonly sql: Sql;
  readonly database: Database;
  readonly sendEmail: SendEmail | null;
  readonly origin: string;
}

const failure = (...codes: SiteverifyErrorCode[]): SiteverifyResponse => ({ success: false, "error-codes": codes });

/**
 * Redeems a widget token for the site that owns `secret`. A token verifies once; the account is
 * charged only here, on success, so nobody can drain credit by solving challenges.
 */
export async function siteverify(
  deps: SiteverifyDeps,
  input: { secret?: unknown; response?: unknown },
  now = Date.now(),
): Promise<SiteverifyResponse> {
  const secret = typeof input.secret === "string" ? input.secret.trim() : "";
  const response = typeof input.response === "string" ? input.response.trim() : "";
  if (!secret) {
    return failure("missing-input-secret");
  }
  if (!response) {
    return failure("missing-input-response");
  }
  if (!secret.startsWith(SECRET_KEY_PREFIX)) {
    return failure("invalid-input-secret");
  }
  if (!response.startsWith(TOKEN_PREFIX)) {
    return failure("invalid-input-response");
  }
  const site = await siteBySecret(deps.adapter, secret, now);
  if (!site) {
    return failure("invalid-input-secret");
  }
  // Redeem and charge commit together: a failed charge leaves the token usable for a retry.
  let redeemed: TokenRecord | null = null;
  let balance: number | null = null;
  await withSqlTransaction(deps.database, async (sql) => {
    redeemed = await redeemToken(sql, response, site.id, now);
    if (redeemed && !redeemed.unpaid) {
      balance = await chargeWithin(sql, site.ownerId, site.id, redeemed.assurance, now);
    }
  });
  const token = redeemed as TokenRecord | null;
  if (!token) {
    return failure(
      (await belongsToAnotherSite(deps.sql, response, site.id)) ? "invalid-input-response" : "timeout-or-duplicate",
    );
  }
  if (balance !== null) {
    await notifyBalance(
      deps.adapter,
      deps.sql,
      deps.sendEmail,
      { userId: site.ownerId, balanceMicros: balance, origin: deps.origin },
      now,
    );
  }
  return {
    success: true,
    assurance: token.assurance,
    action: token.action,
    hostname: token.hostname,
    challenge_ts: token.createdAt.toISOString(),
    pseudonym: token.pseudonym,
    unpaid: token.unpaid,
    risk: token.risk,
    "error-codes": [],
  };
}
