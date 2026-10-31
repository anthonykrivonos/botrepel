import type { BetterAuthPlugin } from "better-auth";
import { clientIp, hashKey, type Sql } from "./db";
import { serializeError } from "./errors";
import { Logger } from "./logger";

/** Share of checks that also purge expired windows; spreads the cleanup cost. */
const PURGE_PROBABILITY = 0.01;
const MS_PER_SECOND = 1000;

const logger = new Logger("rate-limit");

export const requestLimitSchema = {
  id: "botrepel-request-limits",
  schema: {
    requestLimit: {
      fields: {
        windowStart: { type: "number", required: true, bigint: true },
        /** Epoch milliseconds when the window ends; the purge deletes by it across every bucket. */
        expiresAt: { type: "number", required: true, bigint: true },
        count: { type: "number", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;

export interface Limit {
  readonly bucket: string;
  readonly max: number;
  readonly windowSeconds: number;
}

/** The caller's IP, hashed so raw addresses are never stored. */
export function callerKey(request: Request, secret: string): string {
  return hashKey(secret, clientIp(request));
}

/** Fixed-window counter; returns the seconds to wait when over the limit. Abuse limits use closed mode. */
export async function overLimit(
  sql: Sql,
  limit: Limit,
  caller: string,
  now = Date.now(),
  failureMode: "open" | "closed" = "open",
): Promise<number | null> {
  const windowMs = limit.windowSeconds * MS_PER_SECOND;
  const window = Math.floor(now / windowMs);
  try {
    const [row] = await sql.all<{ count: number }>(
      `INSERT INTO "requestLimit" ("id", "windowStart", "expiresAt", "count") VALUES (?, ?, ?, 1)
       ON CONFLICT ("id") DO UPDATE SET "count" = "requestLimit"."count" + 1
       RETURNING "count"`,
      [`${limit.bucket}:${caller}:${window}`, window, (window + 1) * windowMs],
    );
    if (!row) {
      throw new Error("Rate limit counter missing.");
    }
    if (Math.random() < PURGE_PROBABILITY) {
      // Between hourly cron runs, a busy server keeps the table small itself.
      await sql.all(`DELETE FROM "requestLimit" WHERE "expiresAt" < ?`, [now]);
    }
    if (Number(row.count) <= limit.max) {
      return null;
    }
    return Math.max(1, Math.ceil(((window + 1) * windowMs - now) / MS_PER_SECOND));
  } catch (error) {
    logger.error("Rate limit check failed", {
      bucket: limit.bucket,
      failureMode,
      cause: serializeError(error),
    });
    if (failureMode === "closed") {
      throw error;
    }
    return null;
  }
}
