import { beforeAll, describe, expect, test } from "bun:test";
import health from "../../../../api/health";
import { createTestApp } from "../helpers";

const app = createTestApp();
beforeAll(() => app.migrate());

describe("api", () => {
  test("health answers ok and is never cached", async () => {
    const response = health.fetch(new Request("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("ready answers once the database does", async () => {
    const response = await app.call("/api/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true });
  });

  test("version carries a request id", async () => {
    const response = await app.call("/api/version");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(await response.json()).toHaveProperty("version");
  });

  test("a known path with another method lists the allowed ones", async () => {
    const response = await app.call("/api/version", { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  test("an unknown path is a JSON 404", async () => {
    const response = await app.call("/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
  });

  test("an oversized body is refused before it is read", async () => {
    const response = await app.call("/api/trpc/me", {
      json: null,
      headers: { "content-length": String(10 * 1024 * 1024) },
    });
    expect(response.status).toBe(413);
  });
});
