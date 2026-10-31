/**
 * Creates the home page's demo site on a house account in the configured database and writes its
 * keys to the repo's .env. With --print, prints them as KEY=value lines instead (for tests and CI).
 * Usage: bun run demo:seed [--print] [extra-domain ...]   e.g. bun run demo:seed botrepel.com
 */
import { resolve } from "node:path";
import { createAuth } from "../apps/web/lib/auth";
import { adapterOf } from "../apps/web/lib/db";
import { grantFreeCredit } from "../apps/web/lib/ledger";
import { createSite } from "../apps/web/lib/sites";
import { upsertEnv } from "../packages/botrepel/src/cli/env-file";

const HOUSE_EMAIL = "demo@botrepel.com";
const args = process.argv.slice(2);
const print = args.includes("--print");
const domains = ["localhost", ...args.filter((arg) => arg !== "--print")];

await import("../apps/web/lib/migrate");

const auth = createAuth();
const adapter = await adapterOf(auth);
let user = await adapter.findOne<{ id: string }>({ model: "user", where: [{ field: "email", value: HOUSE_EMAIL }] });
if (!user) {
  user = await adapter.create<
    { email: string; name: string; emailVerified: boolean; createdAt: Date; updatedAt: Date },
    { id: string }
  >({
    model: "user",
    data: {
      email: HOUSE_EMAIL,
      name: "BotRepel demo",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await grantFreeCredit(auth.options.database, user.id);
}
const created = await createSite(adapter, user.id, { name: "Home page demo", domains });
if (!created.success) {
  throw new Error(created.error.message);
}
const keys = { PUBLIC_DEMO_SITE_KEY: created.data.site.siteKey, DEMO_SECRET_KEY: created.data.secretKey };
if (print) {
  console.info(
    Object.entries(keys)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
} else {
  await upsertEnv(resolve(import.meta.dir, ".."), ".env", keys);
  console.info(`Demo site for ${domains.join(", ")} written to .env. Restart the server to pick it up.`);
}
