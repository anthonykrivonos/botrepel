import type { Sql } from "../db";
import { Logger } from "../logger";

/**
 * Schema changes Better Auth's migrator can't make (it only creates tables and adds columns):
 * indexes, constraints, data fixes. Each runs once, in order, recorded in "schemaMigration".
 * Statements must work on SQLite and Postgres alike. Never edit one that has shipped; add another.
 */
interface Migration {
  readonly id: string;
  up(sql: Sql): Promise<void>;
}

const MIGRATIONS: readonly Migration[] = [
  {
    id: "0001-site-owner-name-unique",
    // `botrepel init` finds a project's site by name; two concurrent runs must not create two.
    up: (sql) =>
      sql
        .all(`CREATE UNIQUE INDEX IF NOT EXISTS "site_owner_name" ON "site" ("ownerId", "name")`, [])
        .then(() => undefined),
  },
  {
    id: "0002-request-limit-expiry-index",
    up: (sql) =>
      sql
        .all(`CREATE INDEX IF NOT EXISTS "requestLimit_expiresAt" ON "requestLimit" ("expiresAt")`, [])
        .then(() => undefined),
  },
  {
    id: "0003-drop-float-score-columns",
    // Databases from before scores became scaled integers (riskMilli, …E4) still have these
    // required columns, which nothing writes, so every insert would fail.
    up: async (sql) => {
      const legacy: readonly (readonly [string, string])[] = [
        ["challenge", "risk"],
        ["verificationToken", "risk"],
        ["livenessStat", "correlation"],
        ["livenessStat", "gainSpread"],
        ["livenessStat", "depth"],
      ];
      for (const [table, column] of legacy) {
        // SQLite has no DROP COLUMN IF EXISTS, so probe first. Qualified, because SQLite reads an
        // unknown bare "name" as a string literal and the probe would always succeed.
        const exists = await sql.all(`SELECT "${table}"."${column}" FROM "${table}" LIMIT 0`, []).then(
          () => true,
          () => false,
        );
        if (exists) {
          await sql.all(`ALTER TABLE "${table}" DROP COLUMN "${column}"`, []);
        }
      }
    },
  },
  {
    id: "0004-drop-liveness-lag-frames",
    // The lag is now measured in ms ("lagMs"); the required frame-count column would fail every insert.
    up: async (sql) => {
      const exists = await sql.all(`SELECT "livenessStat"."lagFrames" FROM "livenessStat" LIMIT 0`, []).then(
        () => true,
        () => false,
      );
      if (exists) {
        await sql.all(`ALTER TABLE "livenessStat" DROP COLUMN "lagFrames"`, []);
      }
    },
  },
  {
    id: "0005-demo-credential",
    // The home page demo's secret, sealed with CHALLENGE_SECRET. One row. Never sent to the browser.
    up: (sql) =>
      sql
        .all(
          `CREATE TABLE IF NOT EXISTS "demoCredential" (
             "id" TEXT PRIMARY KEY,
             "siteId" TEXT NOT NULL,
             "sealedSecret" TEXT NOT NULL
           )`,
          [],
        )
        .then(() => undefined),
  },
];

const logger = new Logger("migrate");

export async function runMigrations(sql: Sql): Promise<void> {
  await sql.all(`CREATE TABLE IF NOT EXISTS "schemaMigration" ("id" TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)`, []);
  const applied = new Set(
    (await sql.all<{ id: string }>(`SELECT "id" FROM "schemaMigration"`, [])).map((row) => row.id),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }
    await migration.up(sql);
    await sql.all(`INSERT INTO "schemaMigration" ("id", "appliedAt") VALUES (?, ?)`, [
      migration.id,
      new Date().toISOString(),
    ]);
    logger.info(`Applied ${migration.id}`);
  }
}
