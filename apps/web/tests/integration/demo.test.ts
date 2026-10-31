import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import type { SiteView } from "../../lib/sites";
import { createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";

const app = createTestApp();
let demo: { site: SiteView; secretKey: string };
let other: { site: SiteView; secretKey: string };

beforeAll(async () => {
  await app.migrate();
  const cookie = await app.signIn("house@example.com");
  demo = await app.mutation("sites.create", { name: "Demo", domains: ["botrepel.test"] }, cookie);
  other = await app.mutation("sites.create", { name: "Other", domains: ["botrepel.test"] }, cookie);
  process.env.DEMO_SECRET_KEY = demo.secretKey;
});

afterAll(() => {
  delete process.env.DEMO_SECRET_KEY;
});

/** A token from the invisible flow, as the widget would get it. */
async function tokenFor(siteKey: string): Promise<string> {
  const start = await app.call("/v1/challenge/start", {
    json: { siteKey, action: "demo", hostname: "botrepel.test" },
  });
  const challenge = (await start.json()) as StartedChallenge;
  const done = await app.call("/v1/challenge/invisible", {
    json: { challengeId: challenge.challengeId, nonce: solvePow(challenge.pow), signals: { solveMs: 400 } },
  });
  return ((await done.json()) as { token: string }).token;
}

const demoVerify = (token: string, origin?: string): Promise<Response> =>
  app.call("/api/demo/verify", { json: { token }, ...(origin ? { origin } : {}) });

describe("home page demo", () => {
  test("returns the real siteverify response for a demo-site token", async () => {
    const response = await demoVerify(await tokenFor(demo.site.siteKey));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, assurance: "invisible", action: "demo" });
  });

  test("rejects tokens from other sites", async () => {
    const response = await demoVerify(await tokenFor(other.site.siteKey));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, "error-codes": ["invalid-input-response"] });
  });

  test("refuses calls from other origins", async () => {
    const response = await demoVerify(await tokenFor(demo.site.siteKey), "https://evil.example");
    expect(response.status).toBe(403);
  });

  test("is unavailable without a demo secret", async () => {
    delete process.env.DEMO_SECRET_KEY;
    const response = await demoVerify(await tokenFor(demo.site.siteKey));
    expect(response.status).toBe(503);
    process.env.DEMO_SECRET_KEY = demo.secretKey;
  });
});
