import type { Sql } from "./db";

const DAY_MS = 24 * 60 * 60_000;

/** How long past expiry each kind of row stays, then goes. Documented in the privacy policy. */
export const RETENTION = {
  /** Challenges and tokens: a day past expiry, for debugging a customer's report. */
  expired: DAY_MS,
  /** Rate-limit windows: two hours past their end. */
  rateLimit: 2 * 60 * 60_000,
  /** Liveness scores, for threshold calibration. */
  livenessStats: 180 * DAY_MS,
  /** Abuse reports, past the 30-day burn window with margin. */
  reports: 90 * DAY_MS,
} as const;

const iso = (ms: number): string => new Date(ms).toISOString();

/**
 * Deletes everything past its retention. Idempotent and safe to run often. Deleting a token also
 * deletes its pseudonym and pass id, the only record that a pass was used on a site.
 */
export async function purgeExpired(sql: Sql, now = Date.now()): Promise<Record<string, number>> {
  const steps: [string, string, unknown[]][] = [
    ["challenge", `DELETE FROM "challenge" WHERE "expiresAt" < ? RETURNING "id"`, [iso(now - RETENTION.expired)]],
    [
      "verificationToken",
      `DELETE FROM "verificationToken" WHERE "expiresAt" < ? RETURNING "id"`,
      [iso(now - RETENTION.expired)],
    ],
    ["requestLimit", `DELETE FROM "requestLimit" WHERE "expiresAt" < ? RETURNING "id"`, [now - RETENTION.rateLimit]],
    [
      "livenessStat",
      `DELETE FROM "livenessStat" WHERE "day" < ? RETURNING "id"`,
      [iso(now - RETENTION.livenessStats).slice(0, 10)],
    ],
    [
      "humanPassReport",
      `DELETE FROM "humanPassReport" WHERE "createdAt" < ? RETURNING "id"`,
      [iso(now - RETENTION.reports)],
    ],
    ["deviceCode", `DELETE FROM "deviceCode" WHERE "expiresAt" < ? RETURNING "id"`, [iso(now - RETENTION.expired)]],
    ["verification", `DELETE FROM "verification" WHERE "expiresAt" < ? RETURNING "id"`, [iso(now - RETENTION.expired)]],
    ["session", `DELETE FROM "session" WHERE "expiresAt" < ? RETURNING "id"`, [iso(now - RETENTION.expired)]],
  ];
  const deleted: Record<string, number> = {};
  for (const [table, statement, params] of steps) {
    deleted[table] = (await sql.all(statement, params)).length;
  }
  return deleted;
}
