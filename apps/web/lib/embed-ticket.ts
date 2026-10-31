import { sameSecret } from "./keys";

/** Long enough for a form left open a while; the widget reloads itself when it lapses. */
export const EMBED_TICKET_TTL_MS = 2 * 60 * 60_000;

const sign = (secret: string, payload: string): string =>
  new Bun.CryptoHasher("sha256", secret).update(payload).digest("base64url");

/**
 * Binds a widget load to the page that framed it: the hostname comes from the browser's Referer
 * when the challenge page loads, not from anything the widget's code reports later.
 */
export function issueEmbedTicket(secret: string, siteId: string, hostname: string, now = Date.now()): string {
  const payload = `${siteId}|${hostname}|${now + EMBED_TICKET_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(secret, payload)}`;
}

export function readEmbedTicket(
  secret: string,
  ticket: string,
  siteId: string,
  now = Date.now(),
): { hostname: string } | null {
  const [encoded = "", signature = ""] = ticket.split(".");
  const payload = Buffer.from(encoded, "base64url").toString();
  if (!signature || !sameSecret(signature, sign(secret, payload))) {
    return null;
  }
  const [ticketSite, hostname, expires] = payload.split("|");
  return ticketSite === siteId && hostname && Number(expires) > now ? { hostname } : null;
}

/** The embedding page's hostname, from the Referer browsers send on iframe loads. */
export function embedderHost(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}
