/** Creates an account with free credit and one site in the e2e database, and prints the keys as JSON. */
import { createAuth } from "../../lib/auth";
import { adapterOf } from "../../lib/db";
import { grantFreeCredit } from "../../lib/ledger";
import { createSite, updateSite } from "../../lib/sites";

const domains = (process.argv[2] ?? "localhost").split(",");
/** Optional policies as JSON, e.g. {"*":"liveness"}. */
const policies = process.argv[3]
  ? (JSON.parse(process.argv[3]) as Record<string, "invisible" | "presence" | "liveness">)
  : null;
const auth = createAuth();
const adapter = await adapterOf(auth);
const user = await adapter.create<
  { email: string; name: string; emailVerified: boolean; createdAt: Date; updatedAt: Date },
  { id: string }
>({
  model: "user",
  data: {
    email: `e2e-${crypto.randomUUID()}@example.com`,
    name: "E2E",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});
await grantFreeCredit(auth.options.database, user.id);
const created = await createSite(adapter, user.id, { name: "E2E", domains });
if (!created.success) {
  throw new Error(created.error.message);
}
if (policies) {
  await updateSite(adapter, user.id, { siteId: created.data.site.id, policies });
}
console.log(JSON.stringify({ siteKey: created.data.site.siteKey, secretKey: created.data.secretKey }));
