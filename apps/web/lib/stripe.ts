import { MICROS_PER_DOLLAR } from "../src/shared/pricing";

/** Stripe's webhook signature tolerance: older events are refused as replays. */
const SIGNATURE_TOLERANCE_SECONDS = 300;
const STRIPE_TIMEOUT_MS = 10_000;
/** A cent in micro-dollars. */
export const MICROS_PER_CENT = MICROS_PER_DOLLAR / 100;

export interface CheckoutInput {
  readonly userId: string;
  readonly email: string;
  readonly dollars: number;
  readonly origin: string;
}

/** The part of Stripe BotRepel uses, so tests can stand in for it. */
export interface Payments {
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /** The account a charge paid credit into, from the metadata the checkout set; null when unknown. */
  chargeOwner(chargeId: string): Promise<string | null>;
}

/** Credit top-ups through Stripe Checkout, over Stripe's REST API. */
export function stripePayments(secretKey: string): Payments {
  return {
    async createCheckout({ userId, email, dollars, origin }) {
      const form = new URLSearchParams({
        mode: "payment",
        client_reference_id: userId,
        customer_email: email,
        success_url: `${origin}/dashboard?topup=success`,
        cancel_url: `${origin}/dashboard?topup=cancelled`,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(dollars * 100),
        "line_items[0][price_data][product_data][name]": `BotRepel credit ($${dollars})`,
        "metadata[userId]": userId,
        // Stripe copies this onto the charge, so refunds and disputes can find the account.
        "payment_intent_data[metadata][userId]": userId,
      });
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
      });
      const session = (await response.json()) as { url?: string; error?: { message?: string } };
      if (!response.ok || !session.url) {
        throw new Error(`Stripe refused the checkout: ${session.error?.message ?? response.status}`);
      }
      return { url: session.url };
    },
    async chargeOwner(chargeId) {
      const response = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Stripe answered ${response.status} for a charge`);
      }
      const charge = (await response.json()) as { metadata?: { userId?: string } };
      return charge.metadata?.userId ?? null;
    },
  };
}

export interface StripeEvent {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: Record<string, unknown> };
}

/**
 * Checks a `Stripe-Signature` header (`t=…,v1=…`): an HMAC-SHA256 of `t.payload` with the endpoint
 * secret, compared in constant time, and recent enough not to be a replay.
 */
export function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): StripeEvent | null {
  if (!header) {
    return null;
  }
  const parts = new Map<string, string[]>();
  for (const item of header.split(",")) {
    const [key, value] = item.split("=", 2);
    if (key && value) {
      parts.set(key.trim(), [...(parts.get(key.trim()) ?? []), value.trim()]);
    }
  }
  const timestamp = Number(parts.get("t")?.[0]);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return null;
  }
  const expected = new Bun.CryptoHasher("sha256", secret).update(`${timestamp}.${payload}`).digest();
  const matches = (parts.get("v1") ?? []).some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!matches) {
    return null;
  }
  try {
    return JSON.parse(payload) as StripeEvent;
  } catch {
    return null;
  }
}
