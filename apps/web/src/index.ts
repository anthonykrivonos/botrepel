import index from "./index.html";
import widget from "./widget/index.html";
import { readEnv } from "../lib/env";
import { apiRoutes, contentTypeOf, localAgentDocs, pageRedirects, redirectResponse, serveStatic } from "../server";
import { accountPages, pages } from "./site/content";
import { discoveryFiles } from "./site/seo";

const DEFAULT_PORT = 3000;

// Local SQLite is created and kept current on every start; production migrates at build.
await import("../lib/migrate");

const discoveryRoutes = Object.fromEntries(
  Object.entries(discoveryFiles({ origin: "", indexable: false })).map(([filename, content]) => [
    `/${filename}`,
    () => new Response(content, { headers: { "Content-Type": contentTypeOf(filename) } }),
  ]),
);

const publicDirectory = new URL("../public/", import.meta.url);
const publicFiles = Object.fromEntries(
  [...new Bun.Glob("**/*").scanSync({ cwd: publicDirectory.pathname, onlyFiles: true, dot: false })].map((path) => [
    `/${path}`,
    (request: Request) => serveStatic(request, publicDirectory),
  ]),
);

const redirectRoutes = Object.fromEntries(
  Object.entries(pageRedirects).map(([from, redirect]) => [
    from,
    (request: Request) => redirectResponse(request, redirect),
  ]),
);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: readEnv().PORT ?? DEFAULT_PORT,
  routes: {
    ...publicFiles,
    ...discoveryRoutes,
    ...localAgentDocs,
    ...apiRoutes,
    ...redirectRoutes,
    ...Object.fromEntries([...pages, ...accountPages].map((page) => [page.path, index])),
    /** Without a build, the challenge page comes straight from Bun's bundler, without its per-site CSP. */
    "/w/:siteKey": widget,
  },
  fetch: () => new Response("Not found", { status: 404 }),
  // Bun's HMR refuses pages whose Host isn't this server (DNS-rebinding protection), so a tunnel turns it off.
  development: { hmr: readEnv().DEV_HMR !== "0", console: true },
});

console.info(`BotRepel: http://localhost:${server.port}`);
