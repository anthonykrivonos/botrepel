import { describe, expect, test } from "bun:test";
import { EMBED_TICKET_TTL_MS, issueEmbedTicket, readEmbedTicket } from "../../lib/embed-ticket";

describe("embed tickets", () => {
  const secret = "test-secret-test-secret-test-secret";
  const now = 1_800_000_000_000;

  test("carry the framing hostname for their site until they expire", () => {
    const ticket = issueEmbedTicket(secret, "site_1", "acme.com", now);
    expect(readEmbedTicket(secret, ticket, "site_1", now + 1000)).toEqual({ hostname: "acme.com" });
    expect(readEmbedTicket(secret, ticket, "site_1", now + EMBED_TICKET_TTL_MS + 1)).toBeNull();
  });

  test("can't be moved to another site, re-signed, or edited", () => {
    const ticket = issueEmbedTicket(secret, "site_1", "acme.com", now);
    expect(readEmbedTicket(secret, ticket, "site_2", now)).toBeNull();
    expect(readEmbedTicket("another-secret-another-secret-12345", ticket, "site_1", now)).toBeNull();
    const [, signature] = ticket.split(".");
    const forged = `${Buffer.from(`site_1|evil.com|${now + 60_000}`).toString("base64url")}.${signature}`;
    expect(readEmbedTicket(secret, forged, "site_1", now)).toBeNull();
    expect(readEmbedTicket(secret, "garbage", "site_1", now)).toBeNull();
  });
});
