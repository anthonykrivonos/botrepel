import { resolve } from "node:path";
import { domainsOf, type SiteRecord } from "./records";

/** Built by build.ts; a variable path so Vercel's tracer leaves it to includeFiles. */
const SHELL_PATH = resolve(process.cwd(), "apps/web/.build/widget-shell.html");

let shell: Promise<string> | undefined;

export function widgetShell(): Promise<string> {
  shell ??= Bun.file(SHELL_PATH)
    .text()
    .catch((error: unknown) => {
      shell = undefined;
      throw error;
    });
  return shell;
}

/** CSP host sources for the site's domains: HTTPS everywhere, plus any port on localhost. */
export function frameAncestors(domains: readonly string[]): string {
  return domains
    .flatMap((domain) =>
      domain === "localhost"
        ? ["http://localhost:*", "http://127.0.0.1:*", "https://localhost:*"]
        : [`https://${domain}`],
    )
    .join(" ");
}

/** Only the site's own pages may frame the widget, and it may use the camera and passkeys there. */
export function widgetHeaders(site: SiteRecord): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${frameAncestors(domainsOf(site))}`,
    ].join("; "),
    "Permissions-Policy":
      "camera=(self), publickey-credentials-get=(self), publickey-credentials-create=(self), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}
