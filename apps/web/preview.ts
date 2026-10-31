import { readEnv } from "./lib/env";
import { apiRoutes, localAgentDocs, serveStatic } from "./server";

const DEFAULT_PORT = 3000;

await import("./lib/migrate");

const directory = new URL("./dist/", import.meta.url);
if (!(await Bun.file(new URL("index.html", directory)).exists())) {
  throw new Error("No production build found. Run `bun run build` first.");
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: readEnv().PORT ?? DEFAULT_PORT,
  development: false,
  routes: { ...apiRoutes, ...localAgentDocs },
  fetch: (request) => serveStatic(request, directory, true),
});

console.info(`BotRepel (production preview): ${server.url}`);
