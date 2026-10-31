import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { magicLink } from "better-auth/plugins/magic-link";
import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { fakeSiteverify } from "./fake-siteverify";
import { botrepel } from "../src/better-auth";

const ORIGIN = "http://localhost:3000";
const sent: string[] = [];

function createAuth(trustServerCalls = false) {
  return betterAuth({
    baseURL: ORIGIN,
    secret: "botrepel-test-secret-botrepel-test-secret",
    database: new Database(":memory:"),
    emailAndPassword: { enabled: true },
    telemetry: { enabled: false },
    plugins: [
      magicLink({ sendMagicLink: async ({ email }) => void sent.push(email) }),
      botrepel({ secretKey: "br_sk_test", fetch: fakeSiteverify().fetch, trustServerCalls }),
    ],
  });
}

const auth = createAuth();

const call = (path: string, body: unknown, token?: string): Promise<Response> =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(token ? { "x-botrepel-response": token } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  await (await getMigrations(auth.options)).runMigrations();
});

describe("the Better Auth plugin", () => {
  test("a magic link needs a magic-link token, and nothing is emailed without one", async () => {
    const refused = await call("/sign-in/magic-link", { email: "bot@example.com" });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "BOTREPEL_FAILED" });
    expect((await call("/sign-in/magic-link", { email: "bot@example.com" }, "pass:login:1")).status).toBe(403);
    expect(sent).toEqual([]);

    expect((await call("/sign-in/magic-link", { email: "person@example.com" }, "pass:magic-link")).status).toBe(200);
    expect(sent).toEqual(["person@example.com"]);
  });

  test("sign-up takes the token from the header or the body, once", async () => {
    const account = { email: "new@example.com", password: "a-long-password", name: "New" };
    expect((await call("/sign-up/email", account)).status).toBe(403);
    expect((await call("/sign-up/email", { ...account, "botrepel-response": "pass:signup" })).status).toBe(200);
    const login = { email: account.email, password: account.password };
    expect((await call("/sign-in/email", login, "pass:login:2")).status).toBe(200);
    // A spent token fails like a missing one.
    expect((await call("/sign-in/email", login, "pass:login:2")).status).toBe(403);
  });

  test("unchecked endpoints pass through", async () => {
    const session = await auth.handler(new Request(`${ORIGIN}/api/auth/get-session`));
    expect(session.status).toBe(200);
  });

  test("server calls need the token unless trusted", async () => {
    await expect(
      auth.api.signInMagicLink({ body: { email: "server@example.com" }, headers: new Headers() }),
    ).rejects.toThrow();
    const trusted = createAuth(true);
    await (await getMigrations(trusted.options)).runMigrations();
    await trusted.api.signInMagicLink({ body: { email: "seed@example.com" }, headers: new Headers() });
    expect(sent).toContain("seed@example.com");
  });
});
