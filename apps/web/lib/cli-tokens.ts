import type { DBAdapter } from "better-auth";
import { sha256, type Sql } from "./db";
import { randomId } from "./keys";

export const CLI_TOKEN_PREFIX = "br_cli_";

export interface CliTokenView {
  readonly id: string;
  readonly prefix: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

/** A new CLI token for the account; only its hash is stored. */
export async function issueCliToken(adapter: DBAdapter, userId: string, now = Date.now()): Promise<string> {
  const token = CLI_TOKEN_PREFIX + randomId(32);
  await adapter.create({
    model: "cliToken",
    data: {
      userId,
      tokenHash: sha256(token),
      prefix: token.slice(0, CLI_TOKEN_PREFIX.length + 6),
      createdAt: new Date(now),
      lastUsedAt: null,
    },
  });
  return token;
}

/** The account a CLI token belongs to, recording its use. */
export async function cliTokenOwner(sql: Sql, token: string, now = Date.now()): Promise<string | null> {
  if (!token.startsWith(CLI_TOKEN_PREFIX)) {
    return null;
  }
  const [row] = await sql.all<{ userId: string }>(
    `UPDATE "cliToken" SET "lastUsedAt" = ? WHERE "tokenHash" = ? RETURNING "userId"`,
    [new Date(now).toISOString(), sha256(token)],
  );
  return row?.userId ?? null;
}

export async function listCliTokens(adapter: DBAdapter, userId: string): Promise<CliTokenView[]> {
  const rows = await adapter.findMany<{ id: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }>({
    model: "cliToken",
    where: [{ field: "userId", value: userId }],
    sortBy: { field: "createdAt", direction: "desc" },
    limit: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    prefix: row.prefix,
    createdAt: new Date(row.createdAt).toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
  }));
}

export async function revokeCliToken(sql: Sql, userId: string, id: string): Promise<boolean> {
  const rows = await sql.all(`DELETE FROM "cliToken" WHERE "id" = ? AND "userId" = ? RETURNING "id"`, [id, userId]);
  return rows.length > 0;
}
