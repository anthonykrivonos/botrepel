import { beforeAll, describe, expect, test } from "bun:test";
import { sqlFor } from "../../lib/db";
import { FREE_CREDIT_MICROS } from "../../src/shared/pricing";
import { BASE, cookiesFrom, createTestApp, type TestApp } from "../helpers";

const PROVIDERS = {
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
};

type Provider = "github" | "google";

interface StubbedCall {
  readonly url: URL;
  readonly body: string;
}

type StubRoutes = Readonly<Record<string, () => unknown>>;

/**
 * Answers the providers' token and profile endpoints as JSON, refuses any other URL, and restores
 * `fetch` afterwards: bun runs every test file in one process.
 */
async function withFetchStub<T>(routes: StubRoutes, run: (calls: StubbedCall[]) => Promise<T>): Promise<T> {
  const calls: StubbedCall[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const route = routes[`${url.origin}${url.pathname}`];
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${url.href}`);
    }
    calls.push({ url, body: await request.text() });
    return Response.json(route());
  }) as unknown as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = real;
  }
}

const base64url = (value: string): string => Buffer.from(value).toString("base64url");

/** Google's redirect flow only decodes the id token; the signature is checked by the token exchange over TLS. */
const unsignedJwt = (claims: Record<string, unknown>): string =>
  `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}.sig`;

function githubRoutes(email: string): StubRoutes {
  return {
    "https://github.com/login/oauth/access_token": () => ({
      access_token: "gh-token",
      token_type: "bearer",
      scope: "read:user,user:email",
    }),
    // The profile's email is private; Better Auth falls back to the primary address from /user/emails.
    "https://api.github.com/user": () => ({
      id: 4242,
      login: "octocat",
      name: "Octo Cat",
      email: null,
      avatar_url: "https://avatars.githubusercontent.com/u/4242",
    }),
    "https://api.github.com/user/emails": () => [{ email, primary: true, verified: true }],
  };
}

function googleRoutes(email: string): StubRoutes {
  const now = Math.floor(Date.now() / 1000);
  return {
    "https://oauth2.googleapis.com/token": () => ({
      access_token: "g-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
      id_token: unsignedJwt({
        iss: "https://accounts.google.com",
        aud: PROVIDERS.GOOGLE_CLIENT_ID,
        sub: "109000000000000000001",
        email,
        email_verified: true,
        name: "Octo Cat",
        picture: "https://lh3.googleusercontent.com/a/octo",
        iat: now,
        exp: now + 3600,
      }),
    }),
  };
}

interface StartedSignIn {
  /** The provider's authorize URL the browser is sent to. */
  readonly url: URL;
  readonly state: string;
  /** The signed state cookie; the callback needs it as well as the state row. */
  readonly cookie: string;
}

async function startSignIn(app: TestApp, provider: Provider): Promise<StartedSignIn> {
  const response = await app.call("/api/auth/sign-in/social", { json: { provider, callbackURL: "/dashboard" } });
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const parsed = new URL(url);
  const state = parsed.searchParams.get("state");
  if (!state) {
    throw new Error(`The authorize URL has no state: ${url}`);
  }
  return { url: parsed, state, cookie: cookiesFrom(response) };
}

/** What the provider's redirect back looks like: a top-level GET with no Origin header. */
const callback = (
  app: TestApp,
  provider: Provider,
  params: Record<string, string>,
  cookie?: string,
): Promise<Response> =>
  app.call(`/api/auth/callback/${provider}?${new URLSearchParams(params).toString()}`, { cookie, origin: null });

const redirectTarget = (response: Response): URL => {
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location") ?? "", BASE);
};

describe("GitHub and Google sign-in", () => {
  const app = createTestApp({}, {}, PROVIDERS);
  beforeAll(() => app.migrate());

  test("sign-in offers both providers once they are configured", async () => {
    expect(await app.query("signInMethods")).toEqual({ github: true, google: true, magicLink: true });
  });

  test("GitHub: the authorize URL returns to our callback, which signs the person in", async () => {
    const started = await startSignIn(app, "github");
    expect(`${started.url.origin}${started.url.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(started.url.searchParams.get("client_id")).toBe(PROVIDERS.GITHUB_CLIENT_ID);
    expect(started.url.searchParams.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/github`);
    expect(started.url.searchParams.get("scope")).toBe("read:user user:email");
    expect(started.cookie).toContain("state=");

    const { response, calls } = await withFetchStub(githubRoutes("octo@example.com"), async (calls) => ({
      response: await callback(app, "github", { code: "gh-code", state: started.state }, started.cookie),
      calls,
    }));
    const target = redirectTarget(response);
    expect(target.pathname).toBe("/dashboard");
    expect(target.searchParams.get("error")).toBeNull();
    const cookie = cookiesFrom(response);
    expect(cookie).toContain("session_token");
    expect((await app.query<{ email: string }>("me", undefined, cookie)).email).toBe("octo@example.com");

    const exchange = new URLSearchParams(calls.find((call) => call.url.hostname === "github.com")?.body);
    expect(exchange.get("code")).toBe("gh-code");
    expect(exchange.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/github`);
  });

  test("Google: asks to pick an account, uses PKCE, and signs the person in", async () => {
    const started = await startSignIn(app, "google");
    expect(`${started.url.origin}${started.url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(started.url.searchParams.get("client_id")).toBe(PROVIDERS.GOOGLE_CLIENT_ID);
    expect(started.url.searchParams.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/google`);
    expect(started.url.searchParams.get("prompt")).toBe("select_account");
    expect(started.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(started.url.searchParams.get("code_challenge")).toBeTruthy();
    expect(started.url.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);

    const { response, calls } = await withFetchStub(googleRoutes("octo@gmail.example"), async (calls) => ({
      response: await callback(app, "google", { code: "g-code", state: started.state }, started.cookie),
      calls,
    }));
    expect(redirectTarget(response).pathname).toBe("/dashboard");
    const cookie = cookiesFrom(response);
    expect((await app.query<{ email: string; name: string }>("me", undefined, cookie)).email).toBe(
      "octo@gmail.example",
    );

    const exchange = new URLSearchParams(calls[0]?.body);
    expect(exchange.get("code")).toBe("g-code");
    expect(exchange.get("code_verifier")).toBeTruthy();
    expect(exchange.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/google`);
  });

  test("cancelling at the provider returns to the login page", async () => {
    const started = await startSignIn(app, "google");
    const response = await withFetchStub({}, () =>
      callback(app, "google", { error: "access_denied", state: started.state }, started.cookie),
    );
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=access_denied`);
    expect(cookiesFrom(response)).not.toContain("session_token");
  });

  test("a state that was never issued, or arrives without its cookie, is refused", async () => {
    const foreign = await withFetchStub({}, () => callback(app, "github", { code: "x", state: "not-ours" }));
    expect(foreign.headers.get("location")).toBe(`${BASE}/login?error=state_mismatch`);

    const started = await startSignIn(app, "github");
    const noCookie = await withFetchStub({}, () => callback(app, "github", { code: "x", state: started.state }));
    expect(noCookie.headers.get("location")).toBe(`${BASE}/login?error=state_mismatch`);
  });

  test("an invalid magic link returns to the login page", async () => {
    const sent = await app.call("/api/auth/sign-in/magic-link", {
      json: { email: "late@example.com", callbackURL: "/dashboard", errorCallbackURL: "/login" },
    });
    expect(sent.status).toBe(200);
    const link = new URL(app.outbox.at(-1)?.action?.url ?? "");
    link.searchParams.set("token", "tampered");
    const response = await app.call(link.pathname + link.search);
    expect(redirectTarget(response).href).toBe(`${BASE}/login?error=INVALID_TOKEN`);
  });
});

describe("free credit for social sign-ups in production", () => {
  // Production grants the credit only through a GitHub or Google account, and rate-limits /sign-in to
  // three starts per ten seconds from one address: this app makes two.
  const app = createTestApp({}, {}, { ...PROVIDERS, NODE_ENV: "production", BETTER_AUTH_SECRET: "x".repeat(40) });
  beforeAll(() => app.migrate());

  test("GitHub gets the credit once, and Google with the same email joins the same account", async () => {
    const sql = sqlFor(app.auth.options.database);
    const balanceOf = async (userId: string): Promise<number> =>
      Number(
        (await sql.all<{ micros: number }>(`SELECT "micros" FROM "balance" WHERE "userId" = ?`, [userId]))[0]?.micros ??
          0,
      );

    const github = await startSignIn(app, "github");
    const first = await withFetchStub(githubRoutes("founder@example.com"), () =>
      callback(app, "github", { code: "c1", state: github.state }, github.cookie),
    );
    const me = await app.query<{ id: string }>("me", undefined, cookiesFrom(first));
    expect(await balanceOf(me.id)).toBe(FREE_CREDIT_MICROS);

    const google = await startSignIn(app, "google");
    const second = await withFetchStub(googleRoutes("founder@example.com"), () =>
      callback(app, "google", { code: "c2", state: google.state }, google.cookie),
    );
    const again = await app.query<{ id: string }>("me", undefined, cookiesFrom(second));
    expect(again.id).toBe(me.id);
    const accounts = await sql.all<{ providerId: string }>(
      `SELECT "providerId" FROM "account" WHERE "userId" = ? ORDER BY "providerId"`,
      [me.id],
    );
    expect(accounts.map((account) => account.providerId)).toEqual(["github", "google"]);
    expect(await balanceOf(me.id)).toBe(FREE_CREDIT_MICROS);
  });
});
