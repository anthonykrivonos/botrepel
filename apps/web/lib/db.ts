import type { BetterAuthOptions, DBAdapter } from "better-auth";
import { SQL } from "bun";
import { Database } from "bun:sqlite";
import { BunPostgresDialect, postgresParams } from "./bun-postgres-dialect";
import { serializeError } from "./errors";
import { Logger } from "./logger";

/** Connections per Postgres pool. Serverless instances handle a few requests at a time. */
const POSTGRES_POOL_SIZE = 5;
const POSTGRES_IDLE_TIMEOUT_SECONDS = 20;
/** Hex characters kept from hashed keys: 128 bits. */
const HASH_KEY_LENGTH = 32;

const logger = new Logger("db");

/** Raw, parameterized SQL over the database Better Auth uses. Queries use `?` placeholders. */
export interface Sql {
  all<T>(query: string, params: readonly unknown[]): Promise<T[]>;
}

const postgresPools = new Map<string, SQL>();

/** Named prepared statements are off: one prepared before a migration adds columns fails with "cached plan must not change result type". */
export function postgresPool(url: string): SQL {
  let pool = postgresPools.get(url);
  if (!pool) {
    pool = new SQL(url, { max: POSTGRES_POOL_SIZE, idleTimeout: POSTGRES_IDLE_TIMEOUT_SECONDS, prepare: false });
    postgresPools.set(url, pool);
  }
  return pool;
}

export async function withConnectRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof SQL.PostgresError && error.code === "ERR_POSTGRES_CONNECTION_TIMEOUT")) {
      throw error;
    }
    logger.warn("Retrying a Postgres query after a connection timeout", { cause: serializeError(error) });
    return await run();
  }
}

export async function closePostgresPool(url: string): Promise<void> {
  const pool = postgresPools.get(url);
  postgresPools.delete(url);
  await pool?.close();
}

const numberPlaceholders = (query: string): string => {
  let position = 0;
  return query.replace(/\?/g, () => `$${++position}`);
};

/** Only for what the adapter can't express (atomic counters, GROUP BY); statements must run on both SQLite and Postgres. */
export function sqlFor(database: BetterAuthOptions["database"]): Sql {
  if (database instanceof Database) {
    return {
      all: async <T>(query: string, params: readonly unknown[]) =>
        database.query(query).all(...(params as never[])) as T[],
    };
  }
  const dialect = (database as { dialect?: unknown } | undefined)?.dialect;
  if (dialect instanceof BunPostgresDialect) {
    const pool = postgresPool(dialect.url);
    return {
      all: async <T>(query: string, params: readonly unknown[]) =>
        [
          ...(await withConnectRetry(() => pool.unsafe(numberPlaceholders(query), postgresParams(params) as never[]))),
        ] as T[],
    };
  }
  throw new Error("Raw SQL needs SQLite or Postgres.");
}

const sqliteQueue = new WeakMap<Database, Promise<void>>();

export async function withSqlTransaction(
  database: BetterAuthOptions["database"],
  run: (sql: Sql) => Promise<void>,
): Promise<void> {
  if (database instanceof Database) {
    // One SQLite connection can hold one transaction, and `run` awaits, so concurrent callers queue.
    const previous = sqliteQueue.get(database) ?? Promise.resolve();
    const current = previous.then(async () => {
      database.exec("BEGIN IMMEDIATE");
      try {
        await run(sqlFor(database));
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        logger.error("Rolled back SQL transaction", { cause: serializeError(error) });
        throw error;
      }
    });
    sqliteQueue.set(
      database,
      current.catch(() => undefined),
    );
    return current;
  }
  const dialect = (database as { dialect?: unknown } | undefined)?.dialect;
  if (!(dialect instanceof BunPostgresDialect)) {
    throw new Error("Raw SQL needs SQLite or Postgres.");
  }
  await postgresPool(dialect.url).begin(async (transaction) => {
    await run({
      all: async <T>(query: string, params: readonly unknown[]): Promise<T[]> =>
        [...(await transaction.unsafe(numberPlaceholders(query), postgresParams(params) as never[]))] as T[],
    });
  });
}

/** Better Auth types its context adapter with the full options generic, which domain functions don't need. */
export async function adapterOf(auth: { $context: Promise<{ adapter: unknown }> }): Promise<DBAdapter> {
  return (await auth.$context).adapter as DBAdapter;
}

export function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

/** A salted hash of `parts`, short enough for a key column. */
export function hashKey(...parts: readonly string[]): string {
  return sha256(parts.join("|")).slice(0, HASH_KEY_LENGTH);
}

/** The client's IP as the platform reports it (Vercel sets x-forwarded-for). Never store it raw. */
export function clientIp(request: Request): string {
  return networkOf(
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown",
  );
}

/**
 * The unit an address is limited as: IPv4 as is, IPv6 by its /64, since one customer usually holds
 * a whole /64 and can rotate through it freely.
 */
export function networkOf(ip: string): string {
  if (!ip.includes(":")) {
    return ip;
  }
  const [head = "", tail = ""] = ip.toLowerCase().split("%")[0]!.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const full = ip.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${full
    .slice(0, 4)
    .map((part) => part.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
