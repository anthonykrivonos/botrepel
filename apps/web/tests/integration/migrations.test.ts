import { beforeAll, expect, test } from "bun:test";
import { sqlFor } from "../../lib/db";
import { runMigrations } from "../../lib/migrations";
import { createTestApp } from "../helpers";

const app = createTestApp();
beforeAll(() => app.migrate());

test("a database from before scaled-integer scores loses the old required columns", async () => {
  const sql = sqlFor(app.auth.options.database);
  await sql.all(`ALTER TABLE "challenge" ADD COLUMN "risk" REAL NOT NULL DEFAULT 0`, []);
  await sql.all(`DELETE FROM "schemaMigration" WHERE "id" = ?`, ["0003-drop-float-score-columns"]);
  await runMigrations(sql);
  const probe = await sql.all(`SELECT "challenge"."risk" FROM "challenge" LIMIT 0`, []).then(
    () => "present",
    () => "dropped",
  );
  expect(probe).toBe("dropped");
});

test("migrations run once", async () => {
  const sql = sqlFor(app.auth.options.database);
  await runMigrations(sql);
  const rows = await sql.all<{ id: string }>(`SELECT "id" FROM "schemaMigration"`, []);
  expect(rows.map((row) => row.id)).toEqual([...new Set(rows.map((row) => row.id))]);
  expect(rows.length).toBeGreaterThanOrEqual(3);
});
