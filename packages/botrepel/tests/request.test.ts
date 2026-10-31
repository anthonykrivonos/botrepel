import { describe, expect, test } from "bun:test";
import { fakeSiteverify } from "./fake-siteverify";
import { tokenFromRequest, verifyRequest, verifyToken } from "../src/server/request";

const post = (body: BodyInit, type: string, headers: Record<string, string> = {}): Request =>
  new Request("https://app.example/api/sign-up", {
    method: "POST",
    body,
    headers: { "content-type": type, ...headers },
  });

describe("tokenFromRequest", () => {
  test("reads the header, then JSON, URL-encoded, and multipart bodies, leaving the body readable", async () => {
    expect(await tokenFromRequest(post("{}", "application/json", { "x-botrepel-response": "t1" }))).toBe("t1");
    expect(await tokenFromRequest(post("{}", "application/json", { "x-captcha-response": "t2" }))).toBe("t2");

    const json = post(JSON.stringify({ email: "a@b.c", "botrepel-response": "t3" }), "application/json");
    expect(await tokenFromRequest(json)).toBe("t3");
    expect(await json.json()).toEqual({ email: "a@b.c", "botrepel-response": "t3" });

    const encoded = post("email=a%40b.c&botrepel-response=t4", "application/x-www-form-urlencoded");
    expect(await tokenFromRequest(encoded)).toBe("t4");
    expect((await encoded.formData()).get("email")).toBe("a@b.c");

    const form = new FormData();
    form.set("botrepel-response", "t5");
    expect(await tokenFromRequest(new Request("https://app.example/", { method: "POST", body: form }))).toBe("t5");
  });

  test("finds nothing in an empty, unparseable, or non-string body", async () => {
    expect(await tokenFromRequest(new Request("https://app.example/"))).toBeNull();
    expect(await tokenFromRequest(post("{not json", "application/json"))).toBeNull();
    expect(await tokenFromRequest(post(JSON.stringify({ "botrepel-response": 1 }), "application/json"))).toBeNull();
  });
});

describe("verifyRequest", () => {
  test("verifies with the secret from the environment, and never calls out without a token", async () => {
    const siteverify = fakeSiteverify();
    const previous = process.env.BOTREPEL_SECRET_KEY;
    process.env.BOTREPEL_SECRET_KEY = "br_sk_env";
    try {
      const missing = await verifyRequest(post("{}", "application/json"), { fetch: siteverify.fetch });
      expect(missing["error-codes"]).toEqual(["missing-input-response"]);
      expect(siteverify.calls()).toBe(0);

      const request = post("{}", "application/json", { "x-botrepel-response": "pass:signup" });
      const result = await verifyRequest(request, { fetch: siteverify.fetch, expectedAction: "signup" });
      expect(result.success).toBe(true);
      expect(siteverify.secrets).toEqual(["br_sk_env"]);
    } finally {
      process.env.BOTREPEL_SECRET_KEY = previous;
    }
  });

  test("fails without a secret instead of calling BotRepel", async () => {
    const previous = process.env.BOTREPEL_SECRET_KEY;
    delete process.env.BOTREPEL_SECRET_KEY;
    try {
      const siteverify = fakeSiteverify();
      const result = await verifyToken("pass:signup", { fetch: siteverify.fetch });
      expect(result["error-codes"]).toEqual(["missing-input-secret"]);
      expect(siteverify.calls()).toBe(0);
    } finally {
      process.env.BOTREPEL_SECRET_KEY = previous;
    }
  });
});
