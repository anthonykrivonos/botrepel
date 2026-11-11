/**
 * Finds or creates the home page's demo site and writes its keys to the repo's .env.
 * With --print, prints them as KEY=value lines instead (for tests and CI).
 * Usage: bun run demo:seed [--print] [extra-domain ...]   e.g. bun run demo:seed botrepel.com
 * The server does the same when PUBLIC_DEMO_SITE_KEY and DEMO_SECRET_KEY are both unset.
 * Extra domains are added only in that case. Set both keys to keep a site you created yourself.
 */
import { resolve } from "node:path";
import { createAuth } from "../apps/web/lib/auth";
import { demoCredentials } from "../apps/web/lib/demo-site";
import { upsertEnv } from "../packages/botrepel/src/cli/env-file";

const args = process.argv.slice(2);
const print = args.includes("--print");
const domains = args.filter((arg) => arg !== "--print");

await import("../apps/web/lib/migrate");

const keys = await demoCredentials(createAuth(), { domains });
if (!keys.siteKey || !keys.secretKey) {
  throw new Error("The demo site has no keys. Set both demo keys, or neither.");
}
const printed = { PUBLIC_DEMO_SITE_KEY: keys.siteKey, DEMO_SECRET_KEY: keys.secretKey };
if (print) {
  console.info(
    Object.entries(printed)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
} else {
  await upsertEnv(resolve(import.meta.dir, ".."), ".env", printed);
  console.info("Demo site keys written to .env. Restart the server to pick them up.");
}
