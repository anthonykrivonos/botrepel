import type { DBAdapter } from "better-auth";
import { withSqlTransaction, type Sql } from "./db";
import type { Assurance } from "../src/shared/assurance";
import { FREE_CREDIT_MICROS, PRICE_MICROS } from "../src/shared/pricing";
import type { UsageRow } from "../src/shared/usage-csv";

const MS_PER_HOUR = 60 * 60 * 1000;

export const hourOf = (now: number): number => Math.floor(now / MS_PER_HOUR);

export interface BalanceRecord {
  readonly id: string;
  readonly userId: string;
  readonly micros: number;
  readonly lowNotifiedAt: Date | null;
  readonly emptyNotifiedAt: Date | null;
}

type Database = Parameters<typeof withSqlTransaction>[0];

/** Posts a ledger entry and moves the balance in one transaction; a repeated key is a no-op. */
async function post(
  database: Database,
  entry: {
    userId: string;
    siteId: string | null;
    kind: string;
    tier: string | null;
    amountMicros: number;
    key: string;
  },
  now: number,
): Promise<boolean> {
  let posted = false;
  await withSqlTransaction(database, async (sql) => {
    const inserted = await sql.all<{ id: string }>(
      `INSERT INTO "ledgerEntry" ("id", "userId", "siteId", "kind", "tier", "quantity", "amountMicros", "hour", "idempotencyKey", "createdAt")
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`,
      [
        crypto.randomUUID(),
        entry.userId,
        entry.siteId,
        entry.kind,
        entry.tier,
        entry.amountMicros,
        hourOf(now),
        entry.key,
        new Date(now).toISOString(),
      ],
    );
    if (!inserted.length) {
      return;
    }
    await moveBalance(sql, entry.userId, entry.amountMicros);
    posted = true;
  });
  return posted;
}

async function moveBalance(sql: Sql, userId: string, amountMicros: number): Promise<void> {
  await sql.all(
    `INSERT INTO "balance" ("id", "userId", "micros") VALUES (?, ?, ?)
     ON CONFLICT ("userId") DO UPDATE SET "micros" = "balance"."micros" + ?`,
    [crypto.randomUUID(), userId, amountMicros, amountMicros],
  );
}

/** Every account gets the free credit exactly once. */
export function grantFreeCredit(database: Database, userId: string, now = Date.now()): Promise<boolean> {
  return post(
    database,
    { userId, siteId: null, kind: "grant", tier: null, amountMicros: FREE_CREDIT_MICROS, key: `grant:${userId}` },
    now,
  );
}

/** Adds paid credit once per payment, and re-arms the low- and out-of-credit emails. */
export async function topUp(
  database: Database,
  userId: string,
  amountMicros: number,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  const posted = await post(database, { userId, siteId: null, kind: "topup", tier: null, amountMicros, key }, now);
  if (posted) {
    await withSqlTransaction(database, async (sql) => {
      await sql.all(`UPDATE "balance" SET "lowNotifiedAt" = NULL, "emptyNotifiedAt" = NULL WHERE "userId" = ?`, [
        userId,
      ]);
    });
  }
  return posted;
}

/** A refund, a dispute, or a won dispute: moves credit by `amountMicros` (negative takes it back), once per key. */
export function adjust(
  database: Database,
  userId: string,
  amountMicros: number,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  return post(database, { userId, siteId: null, kind: "adjust", tier: null, amountMicros, key }, now);
}

/** Micro-dollars already taken back for refunds of one charge. */
export async function refundedMicros(sql: Sql, userId: string, chargeId: string): Promise<number> {
  const [row] = await sql.all<{ total: number | null }>(
    `SELECT SUM("amountMicros") AS "total" FROM "ledgerEntry" WHERE "userId" = ? AND "idempotencyKey" LIKE ?`,
    [userId, `refund:${chargeId}:%`],
  );
  return -Number(row?.total ?? 0);
}

/**
 * Charges one verification. Usage aggregates into one row per site, tier, and hour, so the
 * ledger grows with time, not traffic. Returns the balance after the charge.
 */
export async function chargeVerification(
  database: Database,
  userId: string,
  siteId: string,
  tier: Assurance,
  now = Date.now(),
): Promise<number> {
  let after = 0;
  await withSqlTransaction(database, async (sql) => {
    after = await chargeWithin(sql, userId, siteId, tier, now);
  });
  return after;
}

/** Charges one verification inside the caller's transaction; returns the balance after. */
export async function chargeWithin(
  sql: Sql,
  userId: string,
  siteId: string,
  tier: Assurance,
  now: number,
): Promise<number> {
  const price = PRICE_MICROS[tier];
  const hour = hourOf(now);
  await sql.all(
    `INSERT INTO "ledgerEntry" ("id", "userId", "siteId", "kind", "tier", "quantity", "amountMicros", "hour", "idempotencyKey", "createdAt")
       VALUES (?, ?, ?, 'usage', ?, 1, ?, ?, ?, ?)
       ON CONFLICT ("idempotencyKey") DO UPDATE SET
         "quantity" = "ledgerEntry"."quantity" + 1,
         "amountMicros" = "ledgerEntry"."amountMicros" + ?`,
    [
      crypto.randomUUID(),
      userId,
      siteId,
      tier,
      -price,
      hour,
      `usage:${siteId}:${tier}:${hour}`,
      new Date(now).toISOString(),
      -price,
    ],
  );
  await moveBalance(sql, userId, -price);
  const [row] = await sql.all<{ micros: number }>(`SELECT "micros" FROM "balance" WHERE "userId" = ?`, [userId]);
  return Number(row?.micros ?? 0);
}

export async function balanceOf(adapter: DBAdapter, userId: string): Promise<BalanceRecord | null> {
  return adapter.findOne<BalanceRecord>({ model: "balance", where: [{ field: "userId", value: userId }] });
}

/** Usage since `sinceHour`, newest first, for the dashboard. */
export async function usageSince(sql: Sql, userId: string, sinceHour: number): Promise<UsageRow[]> {
  const rows = await sql.all<UsageRow>(
    `SELECT "siteId", "tier", "hour", "quantity", "amountMicros" FROM "ledgerEntry"
     WHERE "userId" = ? AND "kind" = 'usage' AND "hour" >= ? ORDER BY "hour" DESC LIMIT 5000`,
    [userId, sinceHour],
  );
  return rows.map((row) => ({
    ...row,
    hour: Number(row.hour),
    quantity: Number(row.quantity),
    amountMicros: Number(row.amountMicros),
  }));
}
