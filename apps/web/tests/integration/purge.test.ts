import { afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import { sqlFor } from "../../lib/db";
import { createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";

const CRON_SECRET = "botrepel-local-cron-secret-not-for-production";
const app = createTestApp();

beforeAll(() => app.migrate());
afterEach(() => setSystemTime());

const count = async (table: string): Promise<number> =>
  Number(
    (await sqlFor(app.auth.options.database).all<{ n: number }>(`SELECT COUNT(*) AS "n" FROM "${table}"`, []))[0]!.n,
  );

describe("the hourly purge", () => {
  test("refuses callers without the cron secret", async () => {
    expect((await app.call("/api/cron/purge")).status).toBe(401);
    expect((await app.call("/api/cron/purge", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  test("deletes challenges, tokens, and rate-limit windows past retention, and keeps fresh ones", async () => {
    const cookie = await app.signIn("purge@example.com");
    const { site } = await app.mutation<{ site: { siteKey: string } }>(
      "sites.create",
      { name: "P", domains: ["acme.com"] },
      cookie,
    );
    const start = (await (
      await app.call("/v1/challenge/start", { json: { siteKey: site.siteKey, hostname: "acme.com" } })
    ).json()) as StartedChallenge;
    await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: solvePow(start.pow) } });

    const purge = async (): Promise<Record<string, number>> =>
      (
        (await (await app.call("/api/cron/purge", { headers: { authorization: `Bearer ${CRON_SECRET}` } })).json()) as {
          deleted: Record<string, number>;
        }
      ).deleted;

    // Nothing is old yet.
    expect((await purge()).verificationToken).toBe(0);
    expect(await count("verificationToken")).toBe(1);

    setSystemTime(new Date(Date.now() + 200 * 24 * 60 * 60_000));
    const deleted = await purge();
    expect(deleted.challenge).toBeGreaterThan(0);
    expect(deleted.verificationToken).toBe(1);
    expect(deleted.requestLimit).toBeGreaterThan(0);
    expect(await count("verificationToken")).toBe(0);
    expect(await count("challenge")).toBe(0);
    // Accounts and sites are never purged.
    expect(await count("site")).toBe(1);
  });
});
