/**
 * Packs the published package and installs the tarball into empty Node projects the way a
 * customer would, then imports every subpath under Node with NODE_ENV=production. Catches what the
 * workspace hides: missing files, unresolved imports, optional peers imported where they shouldn't
 * be, and development-only builds.
 * Usage: bun run build:packages && bun scripts/smoke-packages.ts
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const root = new URL("..", import.meta.url).pathname;
const work = await mkdtemp(join(tmpdir(), "botrepel-smoke-"));
// A throwaway npm cache, so the result never depends on (or touches) the machine's.
const env = { ...process.env, npm_config_cache: join(work, "npm-cache"), NODE_ENV: "production" };
$.env(env);

/** Every subpath, with react 19 and better-auth installed. */
const full = `
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { BotRepel } from "botrepel/react";
import { verify, verifyRequest } from "botrepel";
import { botrepel } from "botrepel/better-auth";
import { withBotRepel } from "botrepel/next-auth";
import { auth0PartialHtml } from "botrepel/auth0";

const html = renderToString(createElement(BotRepel, { siteKey: "br_pk_smoke", action: "signup" }));
if (!html.includes('name="botrepel-response"')) throw new Error("botrepel/react rendered " + html);
const result = await verify({ secretKey: "br_sk_smoke", token: "" });
if (result["error-codes"][0] !== "missing-input-response") throw new Error("verify returned " + JSON.stringify(result));
const missing = await verifyRequest(new Request("https://app.example/x", { method: "POST" }), { secretKey: "br_sk_smoke" });
if (missing.success) throw new Error("verifyRequest passed without a token");
if (botrepel().id !== "botrepel") throw new Error("botrepel/better-auth has no plugin");
const wrapped = withBotRepel({ GET: async () => new Response("get"), POST: async () => new Response("post") });
if ((await (await wrapped.GET(new Request("https://app.example/api/auth/session"))).text()) !== "get") throw new Error("withBotRepel changed GET");
if (!auth0PartialHtml({ siteKey: "br_pk_smoke", loginOrigin: "https://login.example.com", action: "login" }).includes("ulp-botrepel-response")) throw new Error("auth0 partial");
console.log("Imported every subpath.");
`;

/** CommonJS, as an Auth0 Action loads it. */
const commonJs = `
const { verifyToken } = require("botrepel");
const { botrepelPostLogin } = require("botrepel/auth0");
if (typeof verifyToken !== "function" || typeof botrepelPostLogin !== "function") throw new Error("CommonJS exports");
console.log("Required the CommonJS entries.");
`;

/** No optional peers: the server entry must not reach for react or better-auth. */
const bare = `
import { verify } from "botrepel";
if (typeof verify !== "function") throw new Error("verify");
console.log("Imported the server entry without optional peers.");
`;

async function app(name: string, dependencies: readonly string[], files: Record<string, string>): Promise<string> {
  const dir = join(work, name);
  await $`mkdir -p ${dir}`;
  await Bun.write(join(dir, "package.json"), JSON.stringify({ name: `smoke-${name}`, private: true, type: "module" }));
  for (const [file, content] of Object.entries(files)) {
    await Bun.write(join(dir, file), content);
  }
  await $`npm install --silent --no-audit --no-fund ${dependencies}`.cwd(dir);
  return dir;
}

try {
  const packed = await $`npm pack --silent --pack-destination ${work}`.cwd(join(root, "packages", "botrepel")).text();
  const tarball = join(work, packed.trim().split("\n").at(-1)!);

  const fullApp = await app("full", ["react@19", "react-dom@19", "better-auth@1.7.10", tarball], {
    "check.mjs": full,
    "check.cjs": commonJs,
  });
  await $`node check.mjs`.cwd(fullApp);
  await $`node check.cjs`.cwd(fullApp);
  const help = await $`node node_modules/.bin/botrepel --help`.cwd(fullApp).text();
  if (!help.includes("init") || !help.includes("auth0-partial")) {
    throw new Error(`botrepel --help printed: ${help}`);
  }
  console.log("The CLI runs from its tarball.");

  const bareApp = await app("bare", [tarball], { "check.mjs": bare });
  await $`node check.mjs`.cwd(bareApp);
} finally {
  await rm(work, { recursive: true, force: true });
}
