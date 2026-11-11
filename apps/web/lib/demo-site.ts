import type { BetterAuthOptions, DBAdapter } from "better-auth";
import type { Auth } from "./auth";
import { ensureSite } from "./cli-sites";
import { adapterOf, sha256, sqlFor, withSqlTransaction, type Sql } from "./db";
import type { EnvSource } from "./env";
import { isPreviewDeployment, readEnv, requireSecret } from "./env";
import { newSecretKey } from "./keys";
import { grantFreeCredit } from "./ledger";
import { Logger } from "./logger";
import type { SiteRecord } from "./records";
import { ROTATION_GRACE_MS } from "./sites";
import { SITE_DOMAIN } from "../src/shared/constants";
import { CreateSiteSchema } from "../src/shared/site";

/** House account that owns the home page demo. Not a person. */
export const DEMO_HOUSE_EMAIL = "demo@botrepel.com";
export const DEMO_SITE_NAME = "Home page demo";

const DEMO_DOMAINS = ["localhost", SITE_DOMAIN] as const;
const SEAL_VERSION = "v1";
const SEAL_ROW_ID = "home";
/** Short waits so the instance that created the site can store its secret before another rotates it. */
const SEAL_WAIT_ATTEMPTS = 4;
const logger = new Logger("demo");

type Database = NonNullable<BetterAuthOptions["database"]>;

export interface DemoKeys {
  readonly siteKey: string | null;
  readonly secretKey: string | null;
}

export interface DemoCredentialOptions {
  /** Defaults to process.env. Tests pass a fixed source so they do not depend on the shell. */
  readonly source?: EnvSource;
  /** Extra hostnames merged onto the demo site when the keys are created here. */
  readonly domains?: readonly string[];
}

interface SealRow {
  readonly siteId: string;
  readonly sealedSecret: string;
}

const provisions = new WeakMap<object, Promise<DemoKeys>>();

/**
 * Keys for the home page demo. When both env vars are set, they win and the database is left alone.
 * When both are missing, the server finds or creates the demo site and reuses its keys.
 * The secret is sealed in the database so any instance can read it, and it is never returned to the browser.
 */
export function demoCredentials(auth: Auth, options: DemoCredentialOptions = {}): Promise<DemoKeys> {
  const env = readEnv(options.source);
  if (env.DEMO_SECRET_KEY || env.PUBLIC_DEMO_SITE_KEY) {
    return Promise.resolve({
      siteKey: env.PUBLIC_DEMO_SITE_KEY ?? null,
      secretKey: env.DEMO_SECRET_KEY ?? null,
    });
  }
  if (isPreviewDeployment(env)) {
    return Promise.resolve({ siteKey: null, secretKey: null });
  }
  const database = databaseOf(auth);
  if ((options.domains?.length ?? 0) > 0) {
    return provision(auth, database, options.domains ?? []);
  }
  let pending = provisions.get(database);
  if (!pending) {
    pending = provision(auth, database, []).catch((error: unknown) => {
      provisions.delete(database);
      throw error;
    });
    provisions.set(database, pending);
  }
  return pending;
}

async function provision(auth: Auth, database: Database, extraDomains: readonly string[]): Promise<DemoKeys> {
  return withSqliteRetry(() => provisionOnce(auth, database, extraDomains));
}

async function provisionOnce(auth: Auth, database: Database, extraDomains: readonly string[]): Promise<DemoKeys> {
  const adapter = await adapterOf(auth);
  const parsed = CreateSiteSchema.safeParse({
    name: DEMO_SITE_NAME,
    domains: [...DEMO_DOMAINS, ...extraDomains],
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The demo site domains are invalid.");
  }
  const userId = await houseUserId(adapter, database);
  const ensured = await ensureSite(adapter, userId, parsed.data);
  if (!ensured.success) {
    throw new Error(ensured.error.message);
  }
  const siteId = ensured.data.site.id;
  const siteKey = ensured.data.site.siteKey;
  const secretKey = ensured.data.secretKey
    ? await persistNewSecret(database, siteId, ensured.data.secretKey)
    : await secretForExistingSite(database, adapter, siteId);
  logger.info("Prepared the home page demo site");
  return { siteKey, secretKey };
}

async function houseUserId(adapter: DBAdapter, database: Database): Promise<string> {
  const existing = await findHouseUser(adapter);
  const userId = existing ?? (await createHouseUser(adapter));
  await grantFreeCredit(database, userId);
  return userId;
}

async function findHouseUser(adapter: DBAdapter): Promise<string | null> {
  const user = await adapter.findOne<{ id: string }>({
    model: "user",
    where: [{ field: "email", value: DEMO_HOUSE_EMAIL }],
  });
  return user?.id ?? null;
}

async function createHouseUser(adapter: DBAdapter): Promise<string> {
  try {
    const user = await adapter.create<
      { email: string; name: string; emailVerified: boolean; createdAt: Date; updatedAt: Date },
      { id: string }
    >({
      model: "user",
      data: {
        email: DEMO_HOUSE_EMAIL,
        name: "BotRepel demo",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return user.id;
  } catch (error) {
    const raced = await findHouseUser(adapter);
    if (raced) {
      return raced;
    }
    throw error;
  }
}

async function persistNewSecret(database: Database, siteId: string, secret: string): Promise<string> {
  const sealed = await sealSecret(secret);
  const inserted = await sqlFor(database).all<{ id: string }>(
    `INSERT INTO "demoCredential" ("id", "siteId", "sealedSecret") VALUES (?, ?, ?)
     ON CONFLICT ("id") DO NOTHING
     RETURNING "id"`,
    [SEAL_ROW_ID, siteId, sealed],
  );
  if (inserted.length > 0) {
    return secret;
  }
  const row = await readSeal(sqlFor(database));
  if (row?.siteId === siteId) {
    return openSeal(row.sealedSecret);
  }
  await sqlFor(database).all(`UPDATE "demoCredential" SET "siteId" = ?, "sealedSecret" = ? WHERE "id" = ?`, [
    siteId,
    sealed,
    SEAL_ROW_ID,
  ]);
  return secret;
}

async function secretForExistingSite(database: Database, adapter: DBAdapter, siteId: string): Promise<string> {
  for (let attempt = 0; attempt < SEAL_WAIT_ATTEMPTS + 2; attempt++) {
    const site = await siteRecord(adapter, siteId);
    if (!site) {
      throw new Error("The demo site is missing.");
    }
    const row = await readSeal(sqlFor(database));
    if (!row && attempt < SEAL_WAIT_ATTEMPTS) {
      await Bun.sleep(25 * (attempt + 1));
      continue;
    }
    const opened = await matchingSecret(row, site);
    if (opened) {
      return opened;
    }
    const claimed = await claimRotation(database, site);
    if (claimed) {
      return claimed;
    }
  }
  throw new Error("The demo site has no key.");
}

async function matchingSecret(row: SealRow | null, site: SiteRecord): Promise<string | null> {
  if (row?.siteId !== site.id) {
    return null;
  }
  try {
    const secret = await openSeal(row.sealedSecret);
    return sha256(secret) === site.secretHash ? secret : null;
  } catch {
    return null;
  }
}

/**
 * One transaction so two instances cannot each rotate the demo secret.
 * The compare-and-swap on secretHash keeps a single winner. The loser retries and reads that seal.
 */
async function claimRotation(database: Database, site: SiteRecord): Promise<string | null> {
  const next = newSecretKey();
  const sealed = await sealSecret(next.secret);
  const expiresAt = new Date(Date.now() + ROTATION_GRACE_MS).toISOString();
  let outcome: string | null = null;
  await withSqlTransaction(database, async (sql) => {
    const [current] = await sql.all<{ secretHash: string }>(`SELECT "secretHash" FROM "site" WHERE "id" = ?`, [
      site.id,
    ]);
    if (!current) {
      return;
    }
    const row = await readSeal(sql);
    const opened = row ? await matchingSecret(row, { ...site, secretHash: current.secretHash }) : null;
    if (opened) {
      outcome = opened;
      return;
    }
    const updated = await sql.all<{ id: string }>(
      `UPDATE "site"
       SET "secretHash" = ?, "secretPrefix" = ?, "previousSecretHash" = "secretHash", "previousSecretExpiresAt" = ?
       WHERE "id" = ? AND "secretHash" = ?
       RETURNING "id"`,
      [next.hash, next.prefix, expiresAt, site.id, current.secretHash],
    );
    if (updated.length === 0) {
      return;
    }
    await sql.all(
      `INSERT INTO "demoCredential" ("id", "siteId", "sealedSecret") VALUES (?, ?, ?)
       ON CONFLICT ("id") DO UPDATE SET "siteId" = excluded."siteId", "sealedSecret" = excluded."sealedSecret"`,
      [SEAL_ROW_ID, site.id, sealed],
    );
    outcome = next.secret;
  });
  return outcome;
}

async function siteRecord(adapter: DBAdapter, siteId: string): Promise<SiteRecord | null> {
  return adapter.findOne<SiteRecord>({ model: "site", where: [{ field: "id", value: siteId }] });
}

async function readSeal(sql: Sql): Promise<SealRow | null> {
  const [row] = await sql.all<SealRow>(`SELECT "siteId", "sealedSecret" FROM "demoCredential" WHERE "id" = ?`, [
    SEAL_ROW_ID,
  ]);
  return row ?? null;
}

function isSqliteBusy(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "SQLITE_BUSY";
}

async function withSqliteRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 4 || !isSqliteBusy(error)) {
        throw error;
      }
      await Bun.sleep(20 * (attempt + 1));
    }
  }
}

function databaseOf(auth: Auth): Database {
  const database = auth.options.database;
  if (!database || typeof database !== "object") {
    throw new Error("The demo site needs a database.");
  }
  return database;
}

async function aesKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(requireSecret(readEnv(), "CHALLENGE_SECRET")),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function sealSecret(secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(secret)),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv);
  packed.set(cipher, iv.length);
  return `${SEAL_VERSION}.${encodeBase64Url(packed)}`;
}

async function openSeal(sealed: string): Promise<string> {
  const [version, payload] = sealed.split(".");
  if (version !== SEAL_VERSION || !payload) {
    throw new Error("The demo key seal is unreadable.");
  }
  const packed = decodeBase64Url(payload);
  if (packed.length <= 12) {
    throw new Error("The demo key seal is unreadable.");
  }
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(packed.subarray(0, 12)) },
    await aesKey(),
    new Uint8Array(packed.subarray(12)),
  );
  return new TextDecoder().decode(plain);
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
