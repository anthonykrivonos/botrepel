import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const E2E_PORT = 3100;
/** `localhost`, not an IP: WebAuthn won't use an IP address as the relying party. */
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE = "apps/web/.data/e2e.sqlite";

export interface SeededSite {
  readonly siteKey: string;
  readonly secretKey: string;
}

export interface SeededPass {
  readonly credentialId: string;
  /** PKCS#8, base64, as Chrome's virtual authenticator takes it. */
  readonly privateKey: string;
  readonly userHandle: string;
}

/** A Human Pass on the server whose private key a test can load into a virtual authenticator. */
export function seedPass(): SeededPass {
  const output = execFileSync("bun", ["apps/web/tests/e2e/seed-pass.ts"], {
    env: { ...process.env, DATABASE_PATH: E2E_DATABASE, BETTER_AUTH_URL: E2E_ORIGIN },
    encoding: "utf8",
  });
  return JSON.parse(output.trim().split("\n").at(-1)!) as SeededPass;
}

/** A signed-in account's session cookies, for a browser context. */
export function seedSession(): { name: string; value: string }[] {
  const output = execFileSync("bun", ["apps/web/tests/e2e/seed-session.ts"], {
    env: { ...process.env, DATABASE_PATH: E2E_DATABASE, BETTER_AUTH_URL: E2E_ORIGIN },
    encoding: "utf8",
  });
  return JSON.parse(output.trim().split("\n").at(-1)!) as { name: string; value: string }[];
}

/** A fresh site in the database the preview server uses. */
export function seedSite(domains = "localhost", policies?: Record<string, string>): SeededSite {
  const output = execFileSync(
    "bun",
    ["apps/web/tests/e2e/seed-site.ts", domains, ...(policies ? [JSON.stringify(policies)] : [])],
    {
      env: { ...process.env, DATABASE_PATH: E2E_DATABASE, BETTER_AUTH_URL: E2E_ORIGIN },
      encoding: "utf8",
    },
  );
  return JSON.parse(output.trim().split("\n").at(-1)!) as SeededSite;
}

/**
 * A customer's page on another origin (an ephemeral port): it embeds the widget the way the React
 * SDK does and records every message from it on `window.botrepelMessages`.
 */
export async function hostPage(site: SeededSite, action = "signup"): Promise<{ origin: string; server: Server }> {
  let origin = "";
  const server = createServer((_request, response) => {
    const src = `${E2E_ORIGIN}/w/${site.siteKey}?origin=${encodeURIComponent(origin)}&action=${action}`;
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html><body>
      <form><input name="email"><iframe id="botrepel" title="BotRepel human verification" src="${src}" allow="camera; publickey-credentials-get; publickey-credentials-create" style="width:300px;height:64px;border:0"></iframe></form>
      <script>
        window.botrepelMessages = [];
        window.addEventListener("message", (event) => {
          if (event.origin !== "${E2E_ORIGIN}") return;
          window.botrepelMessages.push(event.data);
          // As the React SDK does: the flash check takes over the viewport while it runs.
          if (event.data.type === "botrepel:expand") {
            document.getElementById("botrepel").style.cssText = event.data.expanded
              ? "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647"
              : "width:300px;height:64px;border:0";
          }
        });
      </script></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { origin, server };
}
