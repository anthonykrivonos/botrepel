import { describe, expect, test } from "bun:test";
import { fakeSiteverify } from "./fake-siteverify";
import { AUTH0_FIELD, auth0PartialHtml, botrepelPostLogin, botrepelPreUserRegistration } from "../src/auth0";

function api(): { denied: string[]; access: { deny(reason: string): void } } {
  const denied: string[] = [];
  return { denied, access: { deny: (reason) => void denied.push(reason) } };
}

const secrets = { BOTREPEL_SECRET_KEY: "br_sk_action" };
const form = (token?: string): { method: string; body: Record<string, string> } => ({
  method: "POST",
  body: token ? { username: "a@b.c", [AUTH0_FIELD]: token } : { username: "a@b.c" },
});

describe("Auth0 Actions", () => {
  test("pre-registration denies a sign-up without a signup token, using the Action secret", async () => {
    const siteverify = fakeSiteverify();
    const options = { fetch: siteverify.fetch };
    const refused = api();
    await botrepelPreUserRegistration({ secrets, request: form() }, refused, options);
    await botrepelPreUserRegistration({ secrets, request: form("pass:login") }, refused, options);
    expect(refused.denied).toEqual(["botrepel_failed", "botrepel_failed"]);

    const allowed = api();
    await botrepelPreUserRegistration({ secrets, request: form("pass:signup") }, allowed, options);
    expect(allowed.denied).toEqual([]);
    expect(siteverify.secrets).toEqual(["br_sk_action", "br_sk_action"]);
  });

  test("post-login checks typed-in logins only", async () => {
    const siteverify = fakeSiteverify();
    const options = { fetch: siteverify.fetch };
    const result = api();
    const database = { strategy: "auth0" };
    await botrepelPostLogin({ secrets, connection: database, request: form() }, result, options);
    expect(result.denied).toHaveLength(1);
    await botrepelPostLogin({ secrets, connection: database, request: form("pass:login") }, result, options);
    expect(result.denied).toHaveLength(1);

    // No Universal Login form to carry a token: social, silent auth, refresh tokens, existing sessions.
    await botrepelPostLogin({ secrets, connection: { strategy: "github" }, request: form() }, result, options);
    await botrepelPostLogin(
      { secrets, connection: database, request: form(), transaction: { prompt: ["none"] } },
      result,
      options,
    );
    await botrepelPostLogin(
      { secrets, connection: database, request: form(), transaction: { protocol: "oauth2-refresh-token" } },
      result,
      options,
    );
    await botrepelPostLogin({ secrets, connection: database, request: { method: "GET" } }, result, options);
    expect(result.denied).toHaveLength(1);
  });

  test("the partial embeds the widget for the login domain and fills the ulp- field", () => {
    const html = auth0PartialHtml({
      siteKey: "br_pk_x",
      loginOrigin: "https://login.example.com/u/login",
      action: "signup",
    });
    expect(html).toContain(`name="${AUTH0_FIELD}"`);
    expect(html).toContain('title="BotRepel human verification"');
    expect(html).toContain("https://botrepel.com/w/br_pk_x?origin=https%3A%2F%2Flogin.example.com&amp;action=signup");
    expect(html).toContain('event.origin !== "https://botrepel.com"');
  });
});
