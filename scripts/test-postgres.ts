/**
 * Runs the integration and package suites against Postgres, as production uses. Needs a server:
 * TEST_DATABASE_URL (e.g. postgres://postgres@localhost:5432/postgres). Each test app creates its
 * own database; this drops the leftovers from earlier runs first.
 */
import { SQL } from "bun";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Set TEST_DATABASE_URL to a Postgres server, e.g. postgres://postgres@localhost:5432/postgres");
  process.exit(1);
}
const admin = new SQL(url);
const stale = await admin<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname LIKE 'botrepel_test_%'`;
for (const { datname } of stale) {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
}
await admin.close();

const run = Bun.spawn(["bun", "test", "apps/web/tests/integration", "packages", ...process.argv.slice(2)], {
  stdio: ["inherit", "inherit", "inherit"],
  env: process.env,
});
process.exit(await run.exited);
