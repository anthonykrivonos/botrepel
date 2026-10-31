import { afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import { composeAnalyzer } from "../../lib/liveness/compose";
import { heuristicFlash } from "../../lib/liveness/heuristic";
import { POSE_WINDOW_MS, SCHEDULE_MS } from "../../src/shared/liveness";
import { captureFor, flashBody, poseBody, readSchedule } from "../fixtures/liveness-client";
import { BASE, createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";
import { TestAuthenticator } from "../webauthn-authenticator";

// The pose models are models.test.ts's concern; the anchor here needs only the flash stage.
const app = createTestApp(
  {},
  {
    sleep: async () => {},
    liveness: composeAnalyzer({ flash: heuristicFlash, geometry: null, pad: null, judge: null }),
  },
);
/** A genuine scene clear enough for the stricter anchor pass. */
const ANCHOR_SEED = 2;
let cookie: string;
const sites: { id: string; siteKey: string; secretKey: string }[] = [];

beforeAll(async () => {
  await app.migrate();
  cookie = await app.signIn("pass@example.com");
  for (const name of ["A", "B", "C", "D"]) {
    const created = await app.mutation<{ site: { id: string; siteKey: string }; secretKey: string }>(
      "sites.create",
      { name, domains: ["acme.com"] },
      cookie,
    );
    await app.mutation("sites.update", { siteId: created.site.id, policies: { "*": "presence" } }, cookie);
    sites.push({ ...created.site, secretKey: created.secretKey });
  }
});

afterEach(() => setSystemTime());

async function stepUp(siteKey: string): Promise<{ livenessId: string; presenceId: string }> {
  const start = (await (
    await app.call("/v1/challenge/start", { json: { siteKey, action: "login", hostname: "acme.com" } })
  ).json()) as StartedChallenge;
  return (await (
    await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: solvePow(start.pow) } })
  ).json()) as { livenessId: string; presenceId: string };
}

/** Passes the flash check with a clear synthetic face; returns the Human Pass anchor. */
async function anchor(siteKey: string): Promise<string> {
  const { livenessId } = await stepUp(siteKey);
  const streamed = await readSchedule(await app.call("/v1/liveness/start", { json: { livenessId } }));
  const capture = captureFor("genuine", streamed, ANCHOR_SEED);
  const upload = (path: string, body: Uint8Array<ArrayBuffer>): Promise<Response> =>
    app.api(
      new Request(`${BASE}/v1/liveness/${path}?id=${livenessId}`, { method: "POST", headers: { origin: BASE }, body }),
    );
  setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
  expect((await upload("submit", flashBody(capture))).status).toBe(200);
  setSystemTime(new Date(Date.now() + POSE_WINDOW_MS + 200));
  const outcome = (await (await upload("pose", poseBody(capture))).json()) as { kind: string; anchorId?: string };
  setSystemTime();
  expect(outcome.kind).toBe("token");
  expect(outcome.anchorId).toBeTruthy();
  return outcome.anchorId!;
}

async function createPass(authenticator: TestAuthenticator, siteKey: string): Promise<void> {
  const anchorId = await anchor(siteKey);
  const options = (await (await app.call("/v1/pass/register/options", { json: { anchorId } })).json()) as {
    challenge: string;
  };
  const created = await app.call("/v1/pass/register/verify", {
    json: { anchorId, response: await authenticator.create(options) },
  });
  expect(created.status).toBe(200);
}

/** One tap: the presence step with this authenticator. */
async function usePass(authenticator: TestAuthenticator, siteKey: string, advance = true): Promise<Response> {
  const { presenceId } = await stepUp(siteKey);
  const options = (await (await app.call("/v1/presence/options", { json: { presenceId } })).json()) as {
    challenge: string;
  };
  return app.call("/v1/presence/verify", { json: { presenceId, response: await authenticator.get(options, advance) } });
}

const verify = async (secret: string, token: string): Promise<Record<string, unknown>> =>
  (await (await app.call("/v1/siteverify", { json: { secret, response: token }, origin: null })).json()) as Record<
    string,
    unknown
  >;

describe("Human Pass", () => {
  const authenticator = new TestAuthenticator(BASE);

  beforeAll(async () => {
    await createPass(authenticator, sites[0]!.siteKey);
    // Past the one-hour newness window, so it counts on any visit.
    setSystemTime(new Date(Date.now() + 61 * 60_000));
  });

  test("a presence step-up offers both the pass and the light check", async () => {
    const offer = await stepUp(sites[0]!.siteKey);
    expect(offer.presenceId).toBeTruthy();
    expect(offer.livenessId).toBeTruthy();
  });

  test("one tap earns a presence token with a per-site pseudonym, charged the presence price", async () => {
    setSystemTime(new Date(Date.now() + 61 * 60_000));
    const before = (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;
    const onA = (await (await usePass(authenticator, sites[0]!.siteKey)).json()) as {
      token: string;
      assurance: string;
    };
    expect(onA.assurance).toBe("presence");
    const verifiedA = await verify(sites[0]!.secretKey, onA.token);
    expect(verifiedA).toMatchObject({ success: true, assurance: "presence" });
    const after = (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;
    expect(before - after).toBe(2_000);

    const onB = (await (await usePass(authenticator, sites[1]!.siteKey)).json()) as { token: string };
    const verifiedB = await verify(sites[1]!.secretKey, onB.token);
    expect(verifiedB.pseudonym).toBeTruthy();
    expect(verifiedB.pseudonym).not.toBe(verifiedA.pseudonym);
    // The same person on the same site gets the same pseudonym.
    const again = (await (await usePass(authenticator, sites[0]!.siteKey)).json()) as { token: string };
    expect((await verify(sites[0]!.secretKey, again.token)).pseudonym).toBe(verifiedA.pseudonym);
  });

  test("a replayed signature counter (a cloned authenticator) is refused", async () => {
    setSystemTime(new Date(Date.now() + 61 * 60_000));
    authenticator.counter--;
    expect((await usePass(authenticator, sites[0]!.siteKey, false)).status).toBe(403);
    authenticator.counter++;
  });

  test("a pass can vouch only so many times an hour", async () => {
    setSystemTime(new Date(Date.now() + 3 * 60 * 60_000));
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await usePass(authenticator, sites[2]!.siteKey)).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("creating a Human Pass", () => {
  test("needs an anchor from a clear flash pass, used once", async () => {
    const missing = await app.call("/v1/pass/register/options", { json: { anchorId: "nope" } });
    expect(missing.status).toBe(403);

    const anchorId = await anchor(sites[0]!.siteKey);
    const authenticator = new TestAuthenticator(BASE);
    const options = (await (await app.call("/v1/pass/register/options", { json: { anchorId } })).json()) as {
      challenge: string;
    };
    const response = await authenticator.create(options);
    expect((await app.call("/v1/pass/register/verify", { json: { anchorId, response } })).status).toBe(200);
    expect((await app.call("/v1/pass/register/verify", { json: { anchorId, response } })).status).toBe(403);
  });

  test("a passkey made for another site's origin is refused", async () => {
    const anchorId = await anchor(sites[0]!.siteKey);
    const options = (await (await app.call("/v1/pass/register/options", { json: { anchorId } })).json()) as {
      challenge: string;
    };
    const phished = await new TestAuthenticator("https://evil.example").create(options);
    expect((await app.call("/v1/pass/register/verify", { json: { anchorId, response: phished } })).status).toBe(400);
  });

  test("a brand-new pass doesn't count on a risky visit", async () => {
    const authenticator = new TestAuthenticator(BASE);
    await createPass(authenticator, sites[0]!.siteKey);
    const start = (await (
      await app.call("/v1/challenge/start", {
        json: { siteKey: sites[3]!.siteKey, action: "login", hostname: "acme.com" },
      })
    ).json()) as StartedChallenge;
    const offer = (await (
      await app.call("/v1/challenge/invisible", {
        json: { challengeId: start.challengeId, nonce: solvePow(start.pow), signals: { cdp: true } },
      })
    ).json()) as { presenceId: string };
    const options = (await (
      await app.call("/v1/presence/options", { json: { presenceId: offer.presenceId } })
    ).json()) as {
      challenge: string;
    };
    const response = await authenticator.get(options);
    expect((await app.call("/v1/presence/verify", { json: { presenceId: offer.presenceId, response } })).status).toBe(
      403,
    );
  });
});

describe("abuse reports", () => {
  /** A site with a presence policy, owned by a new account. */
  async function ownerSite(email: string): Promise<{ siteKey: string; secretKey: string }> {
    const owner = await app.signIn(email);
    const created = await app.mutation<{ site: { id: string; siteKey: string }; secretKey: string }>(
      "sites.create",
      { name: "Reporter", domains: ["acme.com"] },
      owner,
    );
    await app.mutation("sites.update", { siteId: created.site.id, policies: { "*": "presence" } }, owner);
    return { siteKey: created.site.siteKey, secretKey: created.secretKey };
  }

  async function reportFrom(
    authenticator: TestAuthenticator,
    site: { siteKey: string; secretKey: string },
  ): Promise<boolean> {
    const { token } = (await (await usePass(authenticator, site.siteKey)).json()) as { token: string };
    const { pseudonym } = await verify(site.secretKey, token);
    const response = await app.call("/v1/feedback", {
      json: { secret: site.secretKey, pseudonym, reason: "spam" },
      origin: null,
    });
    return ((await response.json()) as { burned: boolean }).burned;
  }

  test("one owner's many sites count once, so they can't burn a pass", async () => {
    const authenticator = new TestAuthenticator(BASE);
    await createPass(authenticator, sites[0]!.siteKey);
    // Every site and the account are well established by now.
    setSystemTime(new Date(Date.now() + 31 * 24 * 60 * 60_000));
    const burns = [];
    for (const site of sites.slice(0, 3)) {
      burns.push(await reportFrom(authenticator, site));
    }
    expect(burns).toEqual([false, false, false]);
    expect((await usePass(authenticator, sites[3]!.siteKey)).status).toBe(200);
  });

  test("three established owners burn it; new accounts don't count", async () => {
    const reporters = [];
    for (const email of ["r1@example.com", "r2@example.com", "r3@example.com"]) {
      reporters.push(await ownerSite(email));
    }
    const authenticator = new TestAuthenticator(BASE);
    await createPass(authenticator, sites[0]!.siteKey);

    // A week later the sites are old enough, but the accounts aren't: no burn.
    setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60_000));
    expect(await reportFrom(authenticator, reporters[0]!)).toBe(false);

    // Day 32: the accounts are a month old, and the first report is still inside the 30-day window.
    setSystemTime(new Date(Date.now() + 24 * 24 * 60 * 60_000));
    expect(await reportFrom(authenticator, reporters[1]!)).toBe(false);
    expect(await reportFrom(authenticator, reporters[2]!)).toBe(true);
    expect((await usePass(authenticator, sites[3]!.siteKey)).status).toBe(403);
  });
});
