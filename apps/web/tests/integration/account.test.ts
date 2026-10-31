import { beforeAll, describe, expect, test } from "bun:test";
import { sqlFor } from "../../lib/db";
import { createTestApp } from "../helpers";

const WEBHOOK_SECRET = "whsec_account_test";
const app = createTestApp({}, { stripeWebhookSecret: WEBHOOK_SECRET });
beforeAll(() => app.migrate());

const rows = async (table: string, userColumn: string, userId: string): Promise<number> =>
  (await sqlFor(app.auth.options.database).all(`SELECT 1 FROM "${table}" WHERE "${userColumn}" = ?`, [userId])).length;

describe("your data", () => {
  test("the export holds sites, usage, and tokens, but never a secret", async () => {
    const cookie = await app.signIn("exporter@example.com");
    const { secretKey } = await app.mutation<{ secretKey: string }>(
      "sites.create",
      { name: "E", domains: ["e.com"] },
      cookie,
    );
    const exported = await app.query<{ account: { email: string }; sites: unknown[]; ledger: unknown[] }>(
      "account.export",
      undefined,
      cookie,
    );
    expect(exported.account.email).toBe("exporter@example.com");
    expect(exported.sites).toHaveLength(1);
    expect(exported.ledger.length).toBeGreaterThan(0);
    expect(JSON.stringify(exported)).not.toContain(secretKey);
    expect(JSON.stringify(exported)).not.toContain("secretHash");
  });

  test("deleting the account removes its sites, credit, and ledger, and later payments don't crash", async () => {
    const cookie = await app.signIn("leaver@example.com");
    const userId = (await app.query<{ id: string }>("me", undefined, cookie)).id;
    await app.mutation("sites.create", { name: "L", domains: ["l.com"] }, cookie);
    expect(await rows("site", "ownerId", userId)).toBe(1);

    const deleted = await app.call("/api/auth/delete-user", { json: {}, cookie });
    expect(deleted.status).toBe(200);
    expect(await rows("site", "ownerId", userId)).toBe(0);
    expect(await rows("balance", "userId", userId)).toBe(0);
    expect(await rows("ledgerEntry", "userId", userId)).toBe(0);
    expect(await app.query("me", undefined, cookie)).toBeNull();

    const at = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_late",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_late",
          client_reference_id: userId,
          amount_total: 1000,
          currency: "usd",
          payment_status: "paid",
        },
      },
    });
    const signature = new Bun.CryptoHasher("sha256", WEBHOOK_SECRET).update(`${at}.${body}`).digest("hex");
    const response = await app.api(
      new Request("http://botrepel.test/v1/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${at},v1=${signature}` },
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(await rows("ledgerEntry", "userId", userId)).toBe(0);
  });
});
