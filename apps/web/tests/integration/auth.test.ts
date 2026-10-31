import { beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { createTestApp } from "../helpers";

const app = createTestApp();
beforeAll(() => app.migrate());

describe("sign-in and the dashboard API", () => {
  test("a magic link signs in and the dashboard sees the account", async () => {
    const cookie = await app.signIn("founder@example.com");
    expect(cookie).toContain("session_token");
    const me = await app.query<{ email: string }>("me", undefined, cookie);
    expect(me.email).toBe("founder@example.com");
  });

  test("a new account gets one welcome email", async () => {
    await app.signIn("welcome@example.com");
    await app.signIn("welcome@example.com");
    const welcomes = app.outbox.filter(
      (message) => message.to === "welcome@example.com" && message.subject.startsWith("Welcome"),
    );
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0]!.action?.url).toEndWith("/dashboard");
  });

  test("signed out, the account is null", async () => {
    expect(await app.query("me")).toBeNull();
  });

  test("tRPC refuses cross-site requests and non-JSON bodies", async () => {
    const cookie = await app.signIn("victim@example.com");
    const crossSite = await app.call("/api/trpc/me", { json: null, cookie, origin: "https://evil.example" });
    expect(crossSite.status).toBe(403);
    const form = await app.call("/api/trpc/me", {
      method: "POST",
      cookie,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(form.status).toBe(415);
  });

  test("the CLI signs in with the device flow and calls the API as a bearer", async () => {
    const code = (await (
      await app.call("/api/auth/device/code", { json: { client_id: "botrepel-cli" }, origin: null })
    ).json()) as { device_code: string; user_code: string; verification_uri: string; interval: number };
    expect(code.verification_uri).toContain("/device");

    const pending = await app.call("/api/auth/device/token", {
      json: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: code.device_code,
        client_id: "botrepel-cli",
      },
      origin: null,
    });
    expect(((await pending.json()) as { error: string }).error).toBe("authorization_pending");

    const cookie = await app.signIn("cli@example.com");
    // The /device page claims the code for the signed-in account before it can be approved.
    const claimed = await app.call(`/api/auth/device?user_code=${code.user_code}`, { cookie });
    expect(claimed.status).toBe(200);
    const approved = await app.call("/api/auth/device/approve", { json: { userCode: code.user_code }, cookie });
    expect(approved.status).toBe(200);

    // The CLI waits out the polling interval before asking again.
    setSystemTime(new Date(Date.now() + (code.interval + 1) * 1000));
    try {
      const token = (await (
        await app.call("/api/auth/device/token", {
          json: {
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: code.device_code,
            client_id: "botrepel-cli",
          },
          origin: null,
        })
      ).json()) as { access_token: string };
      const me = await app.call("/api/auth/get-session", { bearer: token.access_token, origin: null });
      expect(((await me.json()) as { user: { email: string } }).user.email).toBe("cli@example.com");
    } finally {
      setSystemTime();
    }
  });

  test("a session token isn't a CLI token", async () => {
    const cookie = await app.signIn("not-cli@example.com");
    const session = (await (await app.call("/api/auth/get-session", { cookie })).json()) as {
      session: { token: string };
    };
    expect((await app.call("/v1/cli/sites", { bearer: session.session.token, origin: null })).status).toBe(401);
  });

  test("another client id cannot start a device sign-in", async () => {
    const response = await app.call("/api/auth/device/code", { json: { client_id: "other" }, origin: null });
    expect(response.status).toBe(400);
  });

  test("one address gets at most five sign-in emails an hour, from any network", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await app.call("/api/auth/sign-in/magic-link", {
        json: { email: "flooded@example.com" },
        headers: { "x-forwarded-for": `198.51.100.${i}` },
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  test("sign-in offers only configured providers", async () => {
    expect(await app.query("signInMethods")).toEqual({ github: false, google: false, magicLink: true });
  });
});
