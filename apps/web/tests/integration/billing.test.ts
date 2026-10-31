import { beforeAll, describe, expect, test } from "bun:test";
import { sqlFor } from "../../lib/db";
import type { CheckoutInput } from "../../lib/stripe";
import { createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";

const WEBHOOK_SECRET = "whsec_test_secret";
const checkouts: CheckoutInput[] = [];
const app = createTestApp(
  {},
  {
    payments: {
      createCheckout: async (input) => {
        checkouts.push(input);
        return { url: `https://checkout.stripe.test/${input.dollars}` };
      },
      chargeOwner: async (chargeId) => (chargeId === "ch_disputed" ? userId : null),
    },
    stripeWebhookSecret: WEBHOOK_SECRET,
  },
);
let cookie: string;
let userId: string;

beforeAll(async () => {
  await app.migrate();
  cookie = await app.signIn("payer@example.com");
  userId = (await app.query<{ id: string }>("me", undefined, cookie)).id;
});

/** A webhook body signed the way Stripe signs it. */
function signed(
  event: unknown,
  secret = WEBHOOK_SECRET,
  at = Math.floor(Date.now() / 1000),
): { body: string; header: string } {
  const body = JSON.stringify(event);
  const signature = new Bun.CryptoHasher("sha256", secret).update(`${at}.${body}`).digest("hex");
  return { body, header: `t=${at},v1=${signature}` };
}

const paid = (sessionId: string, cents: number): unknown => ({
  id: `evt_${sessionId}`,
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      client_reference_id: userId,
      amount_total: cents,
      currency: "usd",
      payment_status: "paid",
    },
  },
});

const chargeEvent = (type: string, object: Record<string, unknown>): unknown => ({
  id: `evt_${crypto.randomUUID()}`,
  type,
  data: { object: { currency: "usd", ...object } },
});

async function deliver(event: { body: string; header: string }): Promise<Response> {
  return app.api(
    new Request("http://botrepel.test/v1/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": event.header, "content-type": "application/json" },
      body: event.body,
    }),
  );
}

const balance = async (): Promise<number> =>
  (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;

describe("top-ups", () => {
  test("checkout is offered for the preset amounts only, for the signed-in account", async () => {
    const { url } = await app.mutation<{ url: string }>("billing.checkout", { dollars: 50 }, cookie);
    expect(url).toBe("https://checkout.stripe.test/50");
    expect(checkouts.at(-1)).toMatchObject({ userId, email: "payer@example.com", dollars: 50 });
    const odd = await app.call("/api/trpc/billing.checkout", { json: { dollars: 7 }, cookie });
    expect(odd.status).toBe(400);
  });

  test("a paid checkout adds its credit once, however often Stripe retries", async () => {
    const before = await balance();
    const event = signed(paid("cs_once", 1000));
    expect((await deliver(event)).status).toBe(200);
    expect((await deliver(event)).status).toBe(200);
    expect(await balance()).toBe(before + 10_000_000);
  });

  test("a wrong secret, a tampered body, or an old signature is refused", async () => {
    const before = await balance();
    expect((await deliver(signed(paid("cs_forged", 100_000), "whsec_wrong"))).status).toBe(400);
    const genuine = signed(paid("cs_tampered", 100));
    expect((await deliver({ body: genuine.body.replace("100", "100000"), header: genuine.header })).status).toBe(400);
    expect(
      (await deliver(signed(paid("cs_old", 100_000), WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600))).status,
    ).toBe(400);
    expect(await balance()).toBe(before);
  });

  test("an unpaid or unrelated event changes nothing", async () => {
    const before = await balance();
    await deliver(
      signed({
        id: "evt_x",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_unpaid",
            client_reference_id: userId,
            amount_total: 5000,
            currency: "usd",
            payment_status: "unpaid",
          },
        },
      }),
    );
    await deliver(signed({ id: "evt_y", type: "customer.created", data: { object: {} } }));
    expect(await balance()).toBe(before);
  });

  test("a delayed bank payment credits when it clears; another currency never does", async () => {
    const before = await balance();
    const session = (paid("cs_bank", 2000) as { data: { object: Record<string, unknown> } }).data.object;
    await deliver(
      signed({
        id: "evt_pending",
        type: "checkout.session.completed",
        data: { object: { ...session, payment_status: "unpaid" } },
      }),
    );
    expect(await balance()).toBe(before);
    await deliver(
      signed({ id: "evt_cleared", type: "checkout.session.async_payment_succeeded", data: { object: session } }),
    );
    expect(await balance()).toBe(before + 20_000_000);
    await deliver(
      signed({
        id: "evt_eur",
        type: "checkout.session.completed",
        data: { object: { ...session, id: "cs_eur", currency: "eur" } },
      }),
    );
    expect(await balance()).toBe(before + 20_000_000);
  });

  test("refunds take back only what's newly refunded, once", async () => {
    const before = await balance();
    const refunded = (cents: number): unknown =>
      chargeEvent("charge.refunded", { id: "ch_refunded", amount_refunded: cents, metadata: { userId } });
    await deliver(signed(refunded(300)));
    await deliver(signed(refunded(300)));
    expect(await balance()).toBe(before - 3_000_000);
    await deliver(signed(refunded(1000)));
    expect(await balance()).toBe(before - 10_000_000);
  });

  test("a dispute takes the credit back, and a won dispute returns it", async () => {
    const before = await balance();
    const dispute = { id: "du_1", charge: "ch_disputed", amount: 500 };
    await deliver(signed(chargeEvent("charge.dispute.created", dispute)));
    await deliver(signed(chargeEvent("charge.dispute.created", dispute)));
    expect(await balance()).toBe(before - 5_000_000);
    await deliver(signed(chargeEvent("charge.dispute.funds_reinstated", dispute)));
    expect(await balance()).toBe(before);
    await deliver(signed(chargeEvent("charge.dispute.created", { ...dispute, id: "du_2", charge: "ch_unknown" })));
    expect(await balance()).toBe(before);
  });

  test("running out degrades to invisible-only; a top-up brings full checks back", async () => {
    const created = await app.mutation<{ site: { id: string; siteKey: string } }>(
      "sites.create",
      { name: "Strict", domains: ["acme.com"] },
      cookie,
    );
    await app.mutation("sites.update", { siteId: created.site.id, policies: { "*": "liveness" } }, cookie);
    const outcome = async (): Promise<string> => {
      const start = (await (
        await app.call("/v1/challenge/start", { json: { siteKey: created.site.siteKey, hostname: "acme.com" } })
      ).json()) as { challengeId: string; pow: { seed: string; bits: number } };
      const done = (await (
        await app.call("/v1/challenge/invisible", {
          json: { challengeId: start.challengeId, nonce: solvePow(start.pow) },
        })
      ).json()) as { kind: string };
      return done.kind;
    };
    const { chargeVerification } = await import("../../lib/ledger");
    // Spend whatever is left, a liveness check at a time, without asking the API each time.
    const left = await balance();
    for (let spent = 0; spent < left; spent += 20_000) {
      await chargeVerification(app.auth.options.database, userId, created.site.id, "liveness");
    }
    expect(await outcome()).toBe("token");
    await deliver(signed(paid("cs_refill", 1000)));
    expect(await balance()).toBeGreaterThan(0);
    expect(await outcome()).toBe("stepUp");
  });

  test("balances past $2,147 stay exact (64-bit money on Postgres)", async () => {
    const before = await balance();
    for (const id of ["cs_big_1", "cs_big_2"]) {
      await deliver(signed(paid(id, 200_000_00)));
    }
    expect(await balance()).toBe(before + 2 * 200_000 * 1_000_000);
  });

  test("a top-up re-arms the low- and out-of-credit emails", async () => {
    const sql = sqlFor(app.auth.options.database);
    const sentAt = new Date().toISOString();
    await sql.all(`UPDATE "balance" SET "lowNotifiedAt" = ?, "emptyNotifiedAt" = ? WHERE "userId" = ?`, [
      sentAt,
      sentAt,
      userId,
    ]);
    await deliver(signed(paid("cs_rearm", 1000)));
    const [row] = await sql.all<{ lowNotifiedAt: unknown; emptyNotifiedAt: unknown }>(
      `SELECT "lowNotifiedAt", "emptyNotifiedAt" FROM "balance" WHERE "userId" = ?`,
      [userId],
    );
    expect(row).toEqual({ lowNotifiedAt: null, emptyNotifiedAt: null });
  });

  test("without Stripe keys, the dashboard says payments aren't set up", async () => {
    const plain = createTestApp();
    await plain.migrate();
    const owner = await plain.signIn("plain@example.com");
    expect((await plain.query<{ canTopUp: boolean }>("billing.summary", undefined, owner)).canTopUp).toBe(false);
    const response = await plain.call("/api/trpc/billing.checkout", { json: { dollars: 10 }, cookie: owner });
    expect(response.status).toBe(503);
  });
});
