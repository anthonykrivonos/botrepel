import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { BASE, createTestApp } from "../../../apps/web/tests/helpers";
import { parseEnv } from "../src/cli/env-file";
import { init } from "../src/cli/init";
import type { Io } from "../src/cli/io";

const app = createTestApp();
beforeAll(() => app.migrate());

const directories: string[] = [];
afterEach(async () => {
  setSystemTime();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function project(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "botrepel-cli-"));
  directories.push(directory);
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(directory, name), content)));
  return directory;
}

/**
 * An Io wired to the in-process API. The first time the CLI waits for approval, the "person"
 * signs in, opens the printed URL, and allows the code, as they would in a browser.
 */
function testIo(
  cwd: string,
  home: string,
  email: string,
): Io & { lines: string[]; commands: string[][]; opened: string[] } {
  const lines: string[] = [];
  const commands: string[][] = [];
  const opened: string[] = [];
  let approved = false;
  return {
    lines,
    commands,
    opened,
    fetch: ((input: string | URL | Request, init?: RequestInit) =>
      app.api(new Request(String(input instanceof Request ? input.url : input), init))) as typeof fetch,
    cwd,
    home,
    env: {},
    interactive: false,
    print: (line) => lines.push(line),
    sleep: async (ms) => {
      setSystemTime(new Date(Date.now() + ms + 1000));
      if (!approved) {
        approved = true;
        const code = lines
          .find((line) => line.trim().startsWith("Code:"))!
          .split("Code:")[1]!
          .trim();
        const cookie = await app.signIn(email);
        await app.call(`/api/auth/device?user_code=${code}`, { cookie });
        await app.call("/api/auth/device/approve", { json: { userCode: code }, cookie });
      }
    },
    openUrl: (url) => opened.push(url),
    run: async (command, args) => {
      commands.push([command, ...args]);
      return 0;
    },
  };
}

const options = { apiOrigin: BASE, domains: ["acme.com"], rotateSecret: false, install: true, json: false };

describe("botrepel init", () => {
  test("signs in with the device flow, creates the site, writes keys, and installs the SDKs", async () => {
    const cwd = await project({
      "package.json": JSON.stringify({ name: "acme-web", dependencies: { next: "15" } }),
      "bun.lock": "",
    });
    const home = await project({});
    const io = testIo(cwd, home, "founder@acme.com");

    const result = await init(io, options);

    expect(io.opened[0]).toContain("/device?user_code=");
    expect(result).toMatchObject({
      created: true,
      wroteSecret: true,
      secretMissing: false,
      installed: true,
      envFile: ".env.local",
    });
    expect(result.site.domains).toEqual(["localhost", "acme.com"]);
    const env = parseEnv(await readFile(join(cwd, ".env.local"), "utf8"));
    expect(env.get("NEXT_PUBLIC_BOTREPEL_SITE_KEY")).toBe(result.site.siteKey);
    expect(env.get("BOTREPEL_SECRET_KEY")).toMatch(/^br_sk_/);
    expect(await readFile(join(cwd, ".gitignore"), "utf8")).toContain(".env.local");
    expect(io.commands).toEqual([["bun", "add", "botrepel"]]);
    expect(io.lines.join("\n")).toContain("process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!");
    expect(result.guides.map((guide) => guide.id)).toEqual(["forms"]);
    // The saved token is private to the user, and scoped: it works on the CLI's endpoints only.
    const credentials = join(home, ".config/botrepel/credentials.json");
    expect((await stat(credentials)).mode & 0o077).toBe(0);
    const saved = Object.values(
      (JSON.parse(await readFile(credentials, "utf8")) as { tokens: Record<string, string> }).tokens,
    )[0]!;
    expect(saved).toMatch(/^br_cli_/);
    expect((await app.call("/v1/cli/sites", { bearer: saved, origin: null })).status).toBe(200);
    const asSession = await app.call("/api/auth/get-session", { bearer: saved, origin: null });
    expect(await asSession.json()).toBeNull();
  });

  test("a Better Auth project gets the plugin steps, in text and in --json", async () => {
    const cwd = await project({
      "package.json": JSON.stringify({ name: "ba", dependencies: { next: "15", "better-auth": "1.7.10" } }),
    });
    const io = testIo(cwd, await project({}), "ba@acme.com");
    const result = await init(io, { ...options, json: true });
    expect(io.commands).toEqual([["npm", "install", "botrepel"]]);
    expect(result.project.auth).toEqual(["better-auth"]);
    expect(result.guides.map((guide) => guide.id)).toEqual(["better-auth", "forms"]);
    const printed = JSON.parse(io.lines.at(-1)!) as { guides: { steps: { code?: string }[] }[] };
    expect(printed.guides[0]!.steps[0]!.code).toContain(`plugins: [botrepel({ apiOrigin: "${BASE}" })]`);
  });

  test("rerunning changes nothing: same site, same secret, no new sign-in", async () => {
    const cwd = await project({ "package.json": JSON.stringify({ name: "rerun", devDependencies: { vite: "7" } }) });
    const home = await project({});
    const first = await init(testIo(cwd, home, "rerun@acme.com"), options);
    const envBefore = await readFile(join(cwd, ".env.local"), "utf8");

    const io = testIo(cwd, home, "rerun@acme.com");
    const second = await init(io, options);
    expect(second.site.id).toBe(first.site.id);
    expect(second).toMatchObject({ created: false, wroteSecret: false, secretMissing: false });
    expect(io.opened).toEqual([]);
    expect(await readFile(join(cwd, ".env.local"), "utf8")).toBe(envBefore);
    expect(envBefore).toContain("VITE_BOTREPEL_SITE_KEY=");
  });

  test("a second clone without the secret is told how to get one, and --rotate-secret issues it", async () => {
    const home = await project({});
    const original = await project({ "package.json": JSON.stringify({ name: "clone" }) });
    await init(testIo(original, home, "clone@acme.com"), options);

    const clone = await project({ "package.json": JSON.stringify({ name: "clone" }) });
    const missing = await init(testIo(clone, home, "clone@acme.com"), { ...options, install: false });
    expect(missing.secretMissing).toBe(true);

    const rotated = await init(testIo(clone, home, "clone@acme.com"), {
      ...options,
      install: false,
      rotateSecret: true,
    });
    expect(rotated).toMatchObject({ wroteSecret: true, secretMissing: false });
    expect(parseEnv(await readFile(join(clone, ".env"), "utf8")).get("BOTREPEL_SECRET_KEY")).toMatch(/^br_sk_/);
  });

  test("the written secret verifies a widget token for the written site key", async () => {
    const cwd = await project({ "package.json": JSON.stringify({ name: "e2e-check", dependencies: { next: "15" } }) });
    await init(testIo(cwd, await project({}), "check@acme.com"), { ...options, install: false });
    const env = parseEnv(await readFile(join(cwd, ".env.local"), "utf8"));
    const { solvePow } = await import("../../../apps/web/tests/pow-solver");
    const start = (await (
      await app.call("/v1/challenge/start", {
        json: { siteKey: env.get("NEXT_PUBLIC_BOTREPEL_SITE_KEY"), action: "signup", hostname: "localhost" },
      })
    ).json()) as { challengeId: string; pow: { seed: string; bits: number } };
    const { token } = (await (
      await app.call("/v1/challenge/invisible", {
        json: { challengeId: start.challengeId, nonce: solvePow(start.pow) },
      })
    ).json()) as { token: string };
    const verified = (await (
      await app.call("/v1/siteverify", {
        json: { secret: env.get("BOTREPEL_SECRET_KEY"), response: token },
        origin: null,
      })
    ).json()) as { success: boolean };
    expect(verified.success).toBe(true);
  });

  test("a denied sign-in stops with exit code 2", async () => {
    const cwd = await project({ "package.json": "{}" });
    const io = testIo(cwd, await project({}), "deny@acme.com");
    io.sleep = async (ms) => {
      setSystemTime(new Date(Date.now() + ms + 1000));
      const code = io.lines
        .find((line) => line.trim().startsWith("Code:"))!
        .split("Code:")[1]!
        .trim();
      const cookie = await app.signIn("deny@acme.com");
      await app.call(`/api/auth/device?user_code=${code}`, { cookie });
      await app.call("/api/auth/device/deny", { json: { userCode: code }, cookie });
    };
    await expect(init(io, options)).rejects.toMatchObject({ exitCode: 2 });
  });
});
