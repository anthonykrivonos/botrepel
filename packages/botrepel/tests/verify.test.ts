import { beforeAll, describe, expect, test } from "bun:test";
import type { StartedChallenge } from "../../../apps/web/lib/challenges";
import { BASE, createTestApp } from "../../../apps/web/tests/helpers";
import { solvePow } from "../../../apps/web/tests/pow-solver";
import { verify } from "../src/server/verify";

const app = createTestApp();
let siteKey: string;
let secretKey: string;

/** Routes the SDK's fetch to the in-process API. */
const inProcess = ((input: string | URL | Request, init?: RequestInit) =>
  app.api(new Request(new URL(String(input instanceof Request ? input.url : input)).toString(), init))) as typeof fetch;

beforeAll(async () => {
  await app.migrate();
  const cookie = await app.signIn("sdk@example.com");
  const created = await app.mutation<{ site: { siteKey: string }; secretKey: string }>(
    "sites.create",
    { name: "SDK", domains: ["acme.com"] },
    cookie,
  );
  siteKey = created.site.siteKey;
  secretKey = created.secretKey;
});

async function freshToken(action = "signup"): Promise<string> {
  const start = (await (
    await app.call("/v1/challenge/start", { json: { siteKey, action, hostname: "acme.com" } })
  ).json()) as StartedChallenge;
  const done = (await (
    await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: solvePow(start.pow) } })
  ).json()) as { token: string };
  return done.token;
}

const options = { secretKey: "", apiOrigin: BASE, fetch: inProcess };

describe("verify", () => {
  test("a fresh token verifies with the expected action and hostname", async () => {
    const result = await verify({
      ...options,
      secretKey,
      token: await freshToken(),
      expectedAction: "signup",
      expectedHostname: "ACME.com",
    });
    expect(result).toMatchObject({ success: true, assurance: "invisible", action: "signup", "error-codes": [] });
  });

  test("a mismatched action or hostname, or too little assurance, is not verified", async () => {
    const result = await verify({
      ...options,
      secretKey,
      token: await freshToken("login"),
      expectedAction: "signup",
      expectedHostname: "other.com",
      minAssurance: "presence",
    });
    expect(result.success).toBe(false);
    expect(result["error-codes"]).toEqual(["action-mismatch", "hostname-mismatch", "insufficient-assurance"]);
  });

  test("a missing token fails without a request, and a network failure is internal-error", async () => {
    expect((await verify({ ...options, secretKey, token: "" }))["error-codes"]).toEqual(["missing-input-response"]);
    const offline = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect((await verify({ ...options, secretKey, token: "br_tk_x", fetch: offline }))["error-codes"]).toEqual([
      "internal-error",
    ]);
  });
});

describe("siteverify compatibility", () => {
  test("answers a Turnstile-shaped request, as Better Auth's captcha plugin sends it", async () => {
    const response = await app.call("/v1/siteverify", {
      origin: null,
      json: { secret: secretKey, response: await freshToken(), remoteip: "203.0.113.7" },
    });
    expect(await response.json()).toMatchObject({
      success: true,
      action: "signup",
      hostname: "acme.com",
      "error-codes": [],
    });
  });
});
