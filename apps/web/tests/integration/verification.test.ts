import { beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import { sqlFor } from "../../lib/db";
import type { SiteView } from "../../lib/sites";
import { createTestApp, type TestApp } from "../helpers";
import { solvePow } from "../pow-solver";

const app = createTestApp();
let cookie: string;
let site: SiteView;
let secretKey: string;

beforeAll(async () => {
  await app.migrate();
  cookie = await app.signIn("owner@example.com");
  ({ site, secretKey } = await app.mutation<{ site: SiteView; secretKey: string }>(
    "sites.create",
    { name: "Acme", domains: ["acme.com", "localhost"] },
    cookie,
  ));
});

/** Runs the widget's invisible flow and returns the outcome body. */
async function passInvisible(
  target: TestApp,
  input: { siteKey: string; action?: string; hostname?: string; signals?: Record<string, unknown> },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const start = await target.call("/v1/challenge/start", {
    json: { siteKey: input.siteKey, action: input.action ?? "signup", hostname: input.hostname ?? "acme.com" },
  });
  if (!start.ok) {
    return { status: start.status, body: (await start.json()) as Record<string, unknown> };
  }
  const challenge = (await start.json()) as StartedChallenge;
  const done = await target.call("/v1/challenge/invisible", {
    json: {
      challengeId: challenge.challengeId,
      nonce: solvePow(challenge.pow),
      signals: input.signals ?? { solveMs: 400 },
    },
  });
  return { status: done.status, body: (await done.json()) as Record<string, unknown> };
}

const verify = async (secret: string, response: string): Promise<Record<string, unknown>> =>
  (await (await app.call("/v1/siteverify", { json: { secret, response }, origin: null })).json()) as Record<
    string,
    unknown
  >;

const balance = async (): Promise<number> =>
  (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;

describe("sites", () => {
  test("a new account starts with $5, and the secret is shown only at creation", async () => {
    expect(await balance()).toBe(5_000_000);
    expect(site.siteKey).toMatch(/^br_pk_[A-Za-z0-9]{16}$/);
    expect(secretKey).toMatch(/^br_sk_[A-Za-z0-9]{32}$/);
    const listed = await app.query<SiteView[]>("sites.list", undefined, cookie);
    expect(JSON.stringify(listed)).not.toContain(secretKey);
    expect(listed[0]!.domains).toEqual(["acme.com", "localhost"]);
  });

  test("domains are normalized and validated", async () => {
    const created = await app.mutation<{ site: SiteView }>(
      "sites.create",
      { name: "Normalized", domains: ["https://App.Example.com:8443/path", "127.0.0.1"] },
      cookie,
    );
    expect(created.site.domains).toEqual(["app.example.com", "localhost"]);
    const bad = await app.call("/api/trpc/sites.create", { json: { name: "Bad", domains: ["not a domain"] }, cookie });
    expect(bad.status).toBe(400);
  });

  test("another account can't touch the site", async () => {
    const other = await app.signIn("other@example.com");
    const response = await app.call("/api/trpc/sites.rotateSecret", { json: { siteId: site.id }, cookie: other });
    expect(response.status).toBe(404);
  });
});

describe("the invisible check and siteverify", () => {
  test("a solved puzzle mints a token that verifies once and charges the invisible price", async () => {
    const before = await balance();
    const { body } = await passInvisible(app, { siteKey: site.siteKey });
    expect(body.kind).toBe("token");
    const result = await verify(secretKey, body.token as string);
    expect(result).toMatchObject({
      success: true,
      assurance: "invisible",
      action: "signup",
      hostname: "acme.com",
      unpaid: false,
    });
    expect(await balance()).toBe(before - 500);

    expect(await verify(secretKey, body.token as string)).toMatchObject({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    });
  });

  test("minting a token never charges; only verification does", async () => {
    const before = await balance();
    await passInvisible(app, { siteKey: site.siteKey });
    expect(await balance()).toBe(before);
  });

  test("a wrong secret, a malformed token, and another site's token all fail", async () => {
    const { body } = await passInvisible(app, { siteKey: site.siteKey });
    expect((await verify("br_sk_wrongwrongwrongwrongwrongwrong12", body.token as string))["error-codes"]).toEqual([
      "invalid-input-secret",
    ]);
    expect((await verify(secretKey, "nope"))["error-codes"]).toEqual(["invalid-input-response"]);
    const otherSite = await app.mutation<{ secretKey: string }>(
      "sites.create",
      { name: "B", domains: ["b.com"] },
      cookie,
    );
    expect((await verify(otherSite.secretKey, body.token as string))["error-codes"]).toEqual([
      "invalid-input-response",
    ]);
  });

  test("another site's secret can't burn a token, and a failed charge leaves it redeemable", async () => {
    const { body } = await passInvisible(app, { siteKey: site.siteKey });
    const other = await app.mutation<{ secretKey: string }>(
      "sites.create",
      { name: "Other", domains: ["o.com"] },
      cookie,
    );
    expect((await verify(other.secretKey, body.token as string))["error-codes"]).toEqual(["invalid-input-response"]);

    // Break the ledger so the charge throws mid-transaction; the redeem must roll back with it.
    const sql = sqlFor(app.auth.options.database);
    await sql.all(`ALTER TABLE "ledgerEntry" RENAME TO "ledgerEntryAway"`, []);
    try {
      const failed = await app.call("/v1/siteverify", {
        json: { secret: secretKey, response: body.token },
        origin: null,
      });
      expect(failed.status).toBe(500);
    } finally {
      await sql.all(`ALTER TABLE "ledgerEntryAway" RENAME TO "ledgerEntry"`, []);
    }
    expect(await verify(secretKey, body.token as string)).toMatchObject({ success: true });
  });

  test("tokens expire after five minutes", async () => {
    const { body } = await passInvisible(app, { siteKey: site.siteKey });
    setSystemTime(new Date(Date.now() + 301_000));
    try {
      expect((await verify(secretKey, body.token as string))["error-codes"]).toEqual(["timeout-or-duplicate"]);
    } finally {
      setSystemTime();
    }
  });

  test("a wrong nonce fails and the challenge can't be retried", async () => {
    const start = (await (
      await app.call("/v1/challenge/start", { json: { siteKey: site.siteKey, hostname: "acme.com" } })
    ).json()) as StartedChallenge;
    const wrong = await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: "0" } });
    expect([400, 410]).toContain(wrong.status);
    const retry = await app.call("/v1/challenge/invisible", {
      json: { challengeId: start.challengeId, nonce: solvePow(start.pow) },
    });
    expect(retry.status).toBe(410);
  });

  test("a page on a domain the site doesn't list can't start a check", async () => {
    const { status } = await passInvisible(app, { siteKey: site.siteKey, hostname: "evil.com" });
    expect(status).toBe(403);
  });

  test("automation signals step up instead of minting a token", async () => {
    const { body } = await passInvisible(app, { siteKey: site.siteKey, signals: { webdriver: true, cdp: true } });
    expect(body).toMatchObject({ kind: "stepUp", required: "liveness", livenessId: expect.any(String) });
  });

  test("a site policy above invisible steps up even for a clean browser", async () => {
    await app.mutation("sites.update", { siteId: site.id, policies: { login: "presence" } }, cookie);
    const { body } = await passInvisible(app, { siteKey: site.siteKey, action: "login" });
    expect(body).toMatchObject({ kind: "stepUp", required: "presence", livenessId: expect.any(String) });
  });

  test("a rotated secret keeps working for 24 hours", async () => {
    const rotated = await app.mutation<{ secretKey: string }>("sites.rotateSecret", { siteId: site.id }, cookie);
    const first = await passInvisible(app, { siteKey: site.siteKey });
    expect((await verify(secretKey, first.body.token as string)).success).toBe(true);
    const second = await passInvisible(app, { siteKey: site.siteKey });
    setSystemTime(new Date(Date.now() + 25 * 3600_000));
    try {
      expect((await verify(secretKey, second.body.token as string))["error-codes"]).toEqual(["invalid-input-secret"]);
    } finally {
      setSystemTime();
    }
    secretKey = rotated.secretKey;
  });
});

describe("running out of credit", () => {
  test("degrade serves invisible tokens marked unpaid, without charging, and emails once", async () => {
    const poor = createTestApp();
    await poor.migrate();
    const owner = await poor.signIn("poor@example.com");
    const { site: poorSite, secretKey: poorSecret } = await poor.mutation<{ site: SiteView; secretKey: string }>(
      "sites.create",
      { name: "Poor", domains: ["acme.com"] },
      owner,
    );
    await poor.mutation("sites.update", { siteId: poorSite.id, policies: { "*": "liveness" } }, owner);
    // Spend the credit directly in the ledger rather than 250 liveness checks.
    const { chargeVerification } = await import("../../lib/ledger");
    const userId = (await poor.query<{ id: string }>("me", undefined, owner)).id;
    for (let i = 0; i < 250; i++) {
      await chargeVerification(poor.auth.options.database, userId, poorSite.id, "liveness");
    }

    const { body } = await passInvisible(poor, { siteKey: poorSite.siteKey });
    expect(body.kind).toBe("token");
    const result = (await (
      await poor.call("/v1/siteverify", { json: { secret: poorSecret, response: body.token }, origin: null })
    ).json()) as Record<string, unknown>;
    expect(result).toMatchObject({ success: true, assurance: "invisible", unpaid: true });
    expect((await poor.query<{ balanceMicros: number }>("billing.summary", undefined, owner)).balanceMicros).toBe(0);

    await poor.mutation("sites.update", { siteId: poorSite.id, onUnpaid: "fail_closed" }, owner);
    const { status } = await passInvisible(poor, { siteKey: poorSite.siteKey });
    expect(status).toBe(503);
  });

  test("the owner is emailed once when credit runs low and once when it runs out", async () => {
    const spender = createTestApp();
    await spender.migrate();
    const owner = await spender.signIn("spender@example.com");
    const { site: spendSite, secretKey: spendSecret } = await spender.mutation<{ site: SiteView; secretKey: string }>(
      "sites.create",
      { name: "Spend", domains: ["acme.com"] },
      owner,
    );
    const { chargeVerification } = await import("../../lib/ledger");
    const userId = (await spender.query<{ id: string }>("me", undefined, owner)).id;
    const charge = (tier: "invisible" | "liveness", times: number): Promise<unknown> =>
      Array.from({ length: times }).reduce<Promise<unknown>>(
        (previous) =>
          previous.then(() => chargeVerification(spender.auth.options.database, userId, spendSite.id, tier)),
        Promise.resolve(),
      );
    // $5 - 200 × $0.02 = $1.00, exactly the low-credit line.
    await charge("liveness", 200);
    const verifyOnce = async (): Promise<void> => {
      const { body } = await passInvisible(spender, { siteKey: spendSite.siteKey });
      await spender.call("/v1/siteverify", { json: { secret: spendSecret, response: body.token }, origin: null });
    };
    const sentBefore = spender.outbox.length;
    await verifyOnce();
    await verifyOnce();
    // $1.00 - 2 × $0.0005 = $0.999; leave exactly one invisible check's worth.
    await charge("invisible", 1997);
    await verifyOnce();
    const notices = spender.outbox.slice(sentBefore).map((message) => message.subject);
    expect(notices).toEqual(["Your BotRepel credit is running low", "Your BotRepel credit ran out"]);
  });
});

describe("the challenge page", () => {
  test("only the site's domains may frame it, and it may use the camera and passkeys", async () => {
    const response = await app.call(`/w/${site.siteKey}`, { headers: { referer: "https://acme.com/signup" } });
    // The shell is built by build.ts; without a build this test only checks the headers path.
    if (response.status === 200) {
      const csp = response.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("frame-ancestors https://acme.com http://localhost:*");
      expect(response.headers.get("permissions-policy")).toContain("camera=(self)");
      expect(response.headers.get("x-frame-options")).toBeNull();
      expect(await response.text()).toContain('name="botrepel-ticket"');
    } else {
      expect(response.status).toBe(500);
    }
    expect((await app.call("/w/br_pk_0000000000000000")).status).toBe(404);
  });

  test("a page on a domain the site doesn't list gets no challenge page", async () => {
    const response = await app.call(`/w/${site.siteKey}`, { headers: { referer: "https://evil.com/" } });
    expect(response.status).toBe(403);
  });

  test("the hostname comes from the signed ticket, not the widget's report", async () => {
    const { issueEmbedTicket } = await import("../../lib/embed-ticket");
    const { requireSecret, readEnv } = await import("../../lib/env");
    const siteRow = await app.query<SiteView[]>("sites.list", undefined, cookie);
    const siteId = siteRow.find((candidate) => candidate.siteKey === site.siteKey)!.id;
    const ticket = issueEmbedTicket(requireSecret(readEnv(), "CHALLENGE_SECRET"), siteId, "acme.com");
    const start = (await (
      await app.call("/v1/challenge/start", { json: { siteKey: site.siteKey, hostname: "localhost", ticket } })
    ).json()) as StartedChallenge;
    const done = (await (
      await app.call("/v1/challenge/invisible", {
        json: { challengeId: start.challengeId, nonce: solvePow(start.pow) },
      })
    ).json()) as { token: string };
    expect((await verify(secretKey, done.token)).hostname).toBe("acme.com");

    const forged = await app.call("/v1/challenge/start", {
      json: { siteKey: site.siteKey, hostname: "acme.com", ticket: `${ticket.split(".")[0]}.forged` },
    });
    expect(forged.status).toBe(403);
  });
});
