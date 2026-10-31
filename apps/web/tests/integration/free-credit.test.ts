import { beforeAll, describe, expect, test } from "bun:test";
import { createAuth, databaseFor } from "../../lib/auth";
import { sqlFor } from "../../lib/db";
import { cookiesFrom } from "../helpers";

/** Production rules, with an outbox instead of Resend. */
const outbox: { action?: { url: string } }[] = [];
const auth = createAuth(
  {
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://botrepel.test",
    BETTER_AUTH_SECRET: "x".repeat(40),
    CHALLENGE_SECRET: "y".repeat(40),
    PASS_PSEUDONYM_KEY: "z".repeat(40),
  },
  { database: databaseFor({ DATABASE_PATH: ":memory:" }), sendEmail: async (message) => void outbox.push(message) },
);
beforeAll(() => auth.migrate());

describe("free credit in production", () => {
  test("a magic-link sign-up alone doesn't get it; linking GitHub does, once", async () => {
    const request = (path: string, init: RequestInit = {}): Promise<Response> =>
      auth.handler(
        new Request(`https://botrepel.test/api/auth${path}`, {
          ...init,
          headers: { origin: "https://botrepel.test", ...init.headers },
        }),
      );
    await request("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "throwaway@example.com" }),
    });
    const link = new URL(outbox.at(-1)!.action!.url);
    const cookie = cookiesFrom(await request(link.pathname.replace("/api/auth", "") + link.search));
    const session = (await (await request("/get-session", { headers: { cookie } })).json()) as { user: { id: string } };
    const sql = sqlFor(auth.options.database);
    const balance = async (): Promise<number> =>
      Number(
        (await sql.all<{ micros: number }>(`SELECT "micros" FROM "balance" WHERE "userId" = ?`, [session.user.id]))[0]
          ?.micros ?? 0,
      );
    expect(await balance()).toBe(0);

    // What Better Auth does when the person links GitHub.
    const adapter = (await auth.$context).internalAdapter;
    for (const providerId of ["github", "google"]) {
      await adapter.createAccount({ userId: session.user.id, providerId, accountId: `${providerId}-123` });
    }
    expect(await balance()).toBe(5_000_000);
  });
});
