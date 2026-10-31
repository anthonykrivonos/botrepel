import { beforeAll, describe, expect, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import { createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";

/** Races that matter on Postgres, where requests really run at once; SQLite serializes them anyway. */
const app = createTestApp();
let cookie: string;
let siteKey: string;
let secretKey: string;

beforeAll(async () => {
  await app.migrate();
  cookie = await app.signIn("racer@example.com");
  const created = await app.mutation<{ site: { siteKey: string }; secretKey: string }>(
    "sites.create",
    { name: "Race", domains: ["acme.com"] },
    cookie,
  );
  siteKey = created.site.siteKey;
  secretKey = created.secretKey;
});

async function token(): Promise<string> {
  const start = (await (
    await app.call("/v1/challenge/start", {
      json: { siteKey, hostname: "acme.com" },
      headers: { "x-forwarded-for": crypto.randomUUID() },
    })
  ).json()) as StartedChallenge;
  const done = (await (
    await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: solvePow(start.pow) } })
  ).json()) as { token: string };
  return done.token;
}

const verify = async (response: string): Promise<boolean> =>
  (
    (await (await app.call("/v1/siteverify", { json: { secret: secretKey, response }, origin: null })).json()) as {
      success: boolean;
    }
  ).success;

const balance = async (): Promise<number> =>
  (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;

describe("under concurrency", () => {
  test("one token verifies exactly once, however many requests race for it", async () => {
    const shared = await token();
    const results = await Promise.all(Array.from({ length: 8 }, () => verify(shared)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test("parallel verifications each charge exactly once", async () => {
    const before = await balance();
    const tokens = await Promise.all(Array.from({ length: 20 }, () => token()));
    const results = await Promise.all(tokens.map((each) => verify(each)));
    expect(results.every(Boolean)).toBe(true);
    expect(before - (await balance())).toBe(20 * 500);
  });

  test("a challenge solution can't be redeemed twice in parallel", async () => {
    const start = (await (
      await app.call("/v1/challenge/start", { json: { siteKey, hostname: "acme.com" } })
    ).json()) as StartedChallenge;
    const nonce = solvePow(start.pow);
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce } }),
      ),
    );
    expect(outcomes.filter((response) => response.status === 200)).toHaveLength(1);
  });
});
