import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { sqlFor } from "../../lib/db";
import { overLimit } from "../../lib/rate-limit";

describe("overLimit", () => {
  const db = new Database(":memory:");
  db.exec(
    `CREATE TABLE "requestLimit" ("id" TEXT PRIMARY KEY, "windowStart" INTEGER NOT NULL, "expiresAt" INTEGER NOT NULL, "count" INTEGER NOT NULL)`,
  );
  const sql = sqlFor(db);
  const limit = { bucket: "test", max: 2, windowSeconds: 60 };
  const now = 1_700_000_000_000;

  test("allows up to the limit, then reports the wait until the window resets", async () => {
    expect(await overLimit(sql, limit, "a", now)).toBeNull();
    expect(await overLimit(sql, limit, "a", now)).toBeNull();
    const retryAfter = await overLimit(sql, limit, "a", now);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  test("counts each caller and window separately", async () => {
    expect(await overLimit(sql, limit, "b", now)).toBeNull();
    expect(await overLimit(sql, limit, "a", now + 60_000)).toBeNull();
  });
});
