import { describe, expect, test } from "bun:test";
import { fakeSiteverify } from "./fake-siteverify";
import { withBotRepel } from "../src/next-auth";

const BASE = "https://app.example/api/auth";

function setup(): {
  POST: (request: Request) => Promise<Response>;
  GET: (request: Request) => Promise<Response>;
  reached: string[];
} {
  const siteverify = fakeSiteverify();
  const reached: string[] = [];
  const handlers = withBotRepel(
    {
      GET: async (_request: Request) => new Response("session"),
      POST: async (request: Request) => {
        // The inner handler still reads the whole body.
        reached.push(String((await request.formData()).get("email") ?? new URL(request.url).pathname));
        return new Response("signed in");
      },
    },
    { secretKey: "br_sk_test", fetch: siteverify.fetch },
  );
  return {
    POST: (request) => Promise.resolve(handlers.POST(request)),
    GET: (request) => Promise.resolve(handlers.GET(request)),
    reached,
  };
}

const form = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Request =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  });

describe("withBotRepel", () => {
  test("refuses a credentials sign-in without a token before Auth.js sees it", async () => {
    const app = setup();
    const page = await app.POST(form("/callback/credentials", { email: "a@b.c", password: "x" }));
    expect(page.status).toBe(303);
    expect(page.headers.get("location")).toBe(`${BASE}/error?error=BotRepel`);

    // next-auth/react's signIn asks for JSON and reads the error from the URL.
    const client = await app.POST(form("/callback/credentials", { email: "a@b.c" }, { "x-auth-return-redirect": "1" }));
    expect(client.status).toBe(403);
    expect(await client.json()).toEqual({ url: `${BASE}/error?error=BotRepel` });
    const v4 = await app.POST(form("/callback/credentials", { email: "a@b.c", json: "true" }));
    expect(v4.status).toBe(403);
    expect(app.reached).toEqual([]);
  });

  test("passes a verified credentials sign-in through with its body intact", async () => {
    const app = setup();
    const response = await app.POST(
      form("/callback/credentials", { email: "a@b.c", "botrepel-response": "pass:login" }),
    );
    expect(await response.text()).toBe("signed in");
    expect(app.reached).toEqual(["a@b.c"]);
  });

  test("magic links need a magic-link token; OAuth, sign-out, and GET pass through", async () => {
    const app = setup();
    expect((await app.POST(form("/signin/resend", { email: "a@b.c", "botrepel-response": "pass:login" }))).status).toBe(
      303,
    );
    expect(
      await (await app.POST(form("/signin/resend", { email: "m@b.c", "botrepel-response": "pass:magic-link" }))).text(),
    ).toBe("signed in");
    expect(await (await app.POST(form("/signin/github", {}))).text()).toBe("signed in");
    expect(await (await app.POST(form("/signout", {}))).text()).toBe("signed in");
    expect(await (await app.GET(new Request(`${BASE}/session`))).text()).toBe("session");
    expect(app.reached).toEqual(["m@b.c", "/api/auth/signin/github", "/api/auth/signout"]);
  });
});
