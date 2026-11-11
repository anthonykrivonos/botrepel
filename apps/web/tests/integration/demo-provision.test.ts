import { rm } from "node:fs/promises";
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { createAuth, databaseFor, type Auth } from "../../lib/auth";
import { adapterOf, sha256 } from "../../lib/db";
import { DEMO_HOUSE_EMAIL, demoCredentials } from "../../lib/demo-site";
import type { SiteRecord } from "../../lib/records";
import { siteBySecret } from "../../lib/sites";

const files: string[] = [];

afterEach(async () => {
  await Promise.all(files.splice(0).map((path) => rm(path, { force: true })));
});

function closeDatabase(auth: Auth): void {
  const database = auth.options.database;
  if (database instanceof Database) {
    database.close();
  }
}

test("concurrent first requests share one demo site and never publish the secret", async () => {
  const path = `/tmp/botrepel-demo-${crypto.randomUUID()}.sqlite`;
  files.push(path, `${path}-wal`, `${path}-shm`);
  const source = { DATABASE_PATH: path, BETTER_AUTH_URL: "http://localhost:3000" };
  const sendEmail = async (): Promise<void> => undefined;
  const database = databaseFor(source);
  const primary = createAuth(source, { database, sendEmail });
  await primary.migrate();
  // One server shares one database object, so the in-memory promise covers overlapping requests.
  const auths = Array.from({ length: 8 }, () => createAuth(source, { database, sendEmail }));
  const follower = createAuth(source, { sendEmail });
  try {
    const keys = await Promise.all(auths.map((auth) => demoCredentials(auth, { source: {} })));
    const siteKey = keys[0]?.siteKey ?? "";
    const secretKey = keys[0]?.secretKey ?? "";
    expect(siteKey).toMatch(/^br_pk_[A-Za-z0-9]{16}$/);
    expect(secretKey).toMatch(/^br_sk_/);
    expect(keys.every((key) => key.siteKey === siteKey && key.secretKey === secretKey)).toBe(true);

    const adapter = await adapterOf(primary);
    const users = await adapter.findMany<{ id: string }>({
      model: "user",
      where: [{ field: "email", value: DEMO_HOUSE_EMAIL }],
      limit: 5,
    });
    expect(users).toHaveLength(1);
    const sites = await adapter.findMany<SiteRecord>({
      model: "site",
      where: [{ field: "ownerId", value: users[0]!.id }],
      sortBy: { field: "createdAt", direction: "asc" },
      limit: 10,
    });
    expect(sites).toHaveLength(1);
    const site = sites[0];
    if (!site) {
      throw new Error("The demo site is missing.");
    }
    expect(site.siteKey).toBe(siteKey);
    expect(sha256(secretKey)).toBe(site.secretHash);
    expect((await siteBySecret(adapter, secretKey))?.siteKey).toBe(siteKey);

    // A later process has its own connection and no memory cache. It reads the sealed secret.
    const followed = await demoCredentials(follower, { source: {} });
    expect(followed).toEqual({ siteKey, secretKey });
  } finally {
    closeDatabase(primary);
    closeDatabase(follower);
  }
});

test("env keys override the database", async () => {
  const path = `/tmp/botrepel-demo-${crypto.randomUUID()}.sqlite`;
  files.push(path, `${path}-wal`, `${path}-shm`);
  const auth = createAuth(
    { DATABASE_PATH: path, BETTER_AUTH_URL: "http://localhost:3000" },
    { sendEmail: async () => undefined },
  );
  try {
    await auth.migrate();
    const keys = await demoCredentials(auth, {
      source: { PUBLIC_DEMO_SITE_KEY: "br_pk_overridekey0001", DEMO_SECRET_KEY: "br_sk_override" },
    });
    expect(keys).toEqual({ siteKey: "br_pk_overridekey0001", secretKey: "br_sk_override" });
    expect(await adapterOf(auth).then((adapter) => adapter.count({ model: "user" }))).toBe(0);
  } finally {
    closeDatabase(auth);
  }
});
