import type { SQL } from "bun";
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from "kysely";
import { closePostgresPool, postgresPool, withConnectRetry } from "./db";

/** A plain object bound for a json column; node-postgres would JSON-encode it, Bun.sql sends "[object Object]". */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Uint8Array) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Bun.sql would send a Date via toString(), which Postgres can't read, so dates go as ISO 8601, and objects as JSON. */
export const postgresParams = (params: readonly unknown[]): unknown[] =>
  params.map((value) =>
    value instanceof Date ? value.toISOString() : isPlainObject(value) ? JSON.stringify(value) : value,
  );

/** Commands whose result reports affected rows. */
const WRITE_COMMANDS = new Set(["INSERT", "UPDATE", "DELETE", "MERGE"]);

/** Shares the process's pool with raw queries; each Kysely connection reserves one pooled connection to keep a transaction on one session. */
export class BunPostgresDialect implements Dialect {
  public constructor(public readonly url: string) {}

  public createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  public createDriver(): Driver {
    return new BunPostgresDriver(this.url);
  }

  public createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler();
  }

  public createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new PostgresIntrospector(db);
  }
}

class BunPostgresDriver implements Driver {
  #sql: SQL | null = null;

  public constructor(private readonly url: string) {}

  public async init(): Promise<void> {
    this.#sql = postgresPool(this.url);
  }

  public async acquireConnection(): Promise<DatabaseConnection> {
    if (!this.#sql) {
      throw new Error("The database driver is not initialized.");
    }
    const sql = this.#sql;
    return new BunPostgresConnection(await withConnectRetry(() => sql.reserve()));
  }

  public async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }

  public async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }

  public async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }

  public async releaseConnection(connection: DatabaseConnection): Promise<void> {
    (connection as BunPostgresConnection).release();
  }

  public async destroy(): Promise<void> {
    this.#sql = null;
    await closePostgresPool(this.url);
  }
}

type ReservedSQL = Awaited<ReturnType<SQL["reserve"]>>;

class BunPostgresConnection implements DatabaseConnection {
  public constructor(private readonly reserved: ReservedSQL) {}

  public async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.reserved.unsafe(query.sql, postgresParams(query.parameters));
    const rows = [...result] as R[];
    const command = (result as { command?: string }).command;
    const count = (result as { count?: number | null }).count;
    return command && WRITE_COMMANDS.has(command) && count != null
      ? { rows, numAffectedRows: BigInt(count) }
      : { rows };
  }

  /** Better Auth does not stream, so this yields one buffered result. */
  public async *streamQuery<R>(query: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    yield await this.executeQuery<R>(query);
  }

  public release(): void {
    this.reserved.release();
  }
}
