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
async function tokenFor(siteKey: string, hostname = "botrepel.test"): Promise<string> {
  const start = await app.call("/v1/challenge/start", {
    json: { siteKey, action: "demo", hostname },
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

  test("finds or creates the demo site when the env keys are unset", async () => {
    const savedSecret = process.env.DEMO_SECRET_KEY;
    const savedPublic = process.env.PUBLIC_DEMO_SITE_KEY;
    delete process.env.DEMO_SECRET_KEY;
    delete process.env.PUBLIC_DEMO_SITE_KEY;
    try {
      const listed = await app.call("/api/demo");
      expect(listed.status).toBe(200);
      const body = (await listed.json()) as { siteKey?: string; secretKey?: string };
      expect(Object.keys(body)).toEqual(["siteKey"]);
      expect(body.siteKey).toMatch(/^br_pk_[A-Za-z0-9]{16}$/);
      expect(JSON.stringify(body)).not.toContain("br_sk_");

      const foreign = await demoVerify(await tokenFor(other.site.siteKey));
      expect(foreign.status).toBe(400);

      const response = await demoVerify(await tokenFor(body.siteKey ?? "", "botrepel.com"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, hostname: "botrepel.com", action: "demo" });

      const again = await app.call("/api/demo");
      expect(await again.json()).toEqual({ siteKey: body.siteKey });
    } finally {
      if (savedSecret === undefined) {
        delete process.env.DEMO_SECRET_KEY;
      } else {
        process.env.DEMO_SECRET_KEY = savedSecret;
      }
      if (savedPublic === undefined) {
        delete process.env.PUBLIC_DEMO_SITE_KEY;
      } else {
        process.env.PUBLIC_DEMO_SITE_KEY = savedPublic;
      }
    }
  });
});
