/** Signs a new account in through a magic link in this process, and prints its session cookies as JSON. */
import { createAuth } from "../../lib/auth";
import type { EmailMessage } from "../../lib/email";

const outbox: EmailMessage[] = [];
const auth = createAuth(undefined, { sendEmail: async (message) => void outbox.push(message) });
const origin = process.env.BETTER_AUTH_URL!;
const sent = await auth.handler(
  new Request(new URL("/api/auth/sign-in/magic-link", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: `e2e-${crypto.randomUUID()}@example.com`, callbackURL: "/dashboard" }),
  }),
);
const link = outbox.at(-1)?.action?.url;
if (!sent.ok || !link) {
  throw new Error(`Magic link failed: ${sent.status}`);
}
const verified = await auth.handler(new Request(link, { headers: { Origin: origin } }));
const cookies = verified.headers.getSetCookie().map((cookie) => {
  const [pair] = cookie.split(";");
  const index = pair!.indexOf("=");
  return { name: pair!.slice(0, index), value: pair!.slice(index + 1) };
});
console.log(JSON.stringify(cookies));
