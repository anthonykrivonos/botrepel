import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./lib/api";
import { installMarkdown, llmsText, type LocalPackages } from "./src/site/install";
import health from "../../api/health";
import vercel from "../../vercel.json";

type RouteHandler = (request: Request) => Response | Promise<Response>;

const headersOf = (source: string): Record<string, string> =>
  Object.fromEntries(
    vercel.headers.find((rule) => rule.source === source)!.headers.map((header) => [header.key, header.value]),
  );

/** The headers vercel.json sends on every response (CSP, HSTS, framing...), so local previews match production. */
export const siteHeaders: Record<string, string> = headersOf("/((?!w/).+)");
/** The home page delegates the camera and passkeys to its own origin, so the live demo widget can step up. */
const homeHeaders: Record<string, string> = headersOf("/");

/** As vercel.json's headers set them for the generated text resources; other files use Bun's type. */
const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function contentTypeOf(path: string, fallback = "application/octet-stream"): string {
  return CONTENT_TYPES[extname(path)] ?? fallback;
}

const repo = resolve(fileURLToPath(import.meta.url), "../../..");
const packed = `${repo}/.cache/packages/`;

/** Agents on this machine install from this checkout: the CLI from source, the package as a packed tarball. */
const localPackages: LocalPackages = {
  pack: `bun run --cwd ${repo} pack:local`,
  cli: `${repo}/packages/botrepel/src/cli/bin.ts`,
  tarball: `${packed}botrepel.tgz`,
};

/** The agent docs for whichever origin the request reached, so a prompt copied locally stays local. */
export const localAgentDocs: Record<string, RouteHandler> = {
  "/install.md": (request) =>
    new Response(installMarkdown(new URL(request.url).origin, localPackages), {
      headers: { ...siteHeaders, "Content-Type": contentTypeOf(".md") },
    }),
  "/llms.txt": (request) =>
    new Response(llmsText(new URL(request.url).origin), {
      headers: { ...siteHeaders, "Content-Type": contentTypeOf(".txt") },
    }),
};

/** Mirrors Vercel: api/health.ts, and api/app.ts for every other /api path. */
export const apiRoutes: Record<string, RouteHandler> = {
  "/api/health": (request) => health.fetch(request),
  "/api": () => new Response("Not found", { status: 404 }),
  "/api/*": (request) => handleApi(request),
  "/v1/*": (request) => handleApi(request),
  /** The challenge page: the API sets its per-site frame-ancestors. */
  "/w/*": (request) => handleApi(request),
};

export interface PageRedirect {
  readonly destination: string;
  /** 308 for permanent redirects, 307 otherwise, as Vercel sends them. */
  readonly status: 307 | 308;
}

/** The "redirects" in vercel.json, so local servers send exactly what Vercel sends. */
export const pageRedirects: Readonly<Record<string, PageRedirect>> = Object.fromEntries(
  (vercel.redirects as { source: string; destination: string; permanent: boolean }[]).map(
    ({ source, destination, permanent }) => [
      source,
      { destination, status: permanent ? 308 : 307 } satisfies PageRedirect,
    ],
  ),
);

/** A redirect from `request` to `redirect`, keeping the query string. */
export function redirectResponse(request: Request, redirect: PageRedirect): Response {
  return new Response(null, {
    status: redirect.status,
    headers: { Location: redirect.destination + new URL(request.url).search },
  });
}

const notFound = (): Response => new Response("Not found", { status: 404 });

/** Dot-files, `..` escapes, and NUL bytes are never served. */
function outsideRoot(root: string, path: string, pathname: string): boolean {
  const localPath = relative(root, path);
  return (
    localPath === ".." ||
    localPath.startsWith(`..${sep}`) ||
    pathname.includes("\0") ||
    localPath.split(sep).some((part) => part.startsWith("."))
  );
}

/** Serves a built directory like Vercel does; with `htmlPages`, clean URLs, vercel.json redirects, and a real 404 page. */
export async function serveStatic(request: Request, directory: URL, htmlPages = false): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const redirect = htmlPages ? pageRedirects[pathname] : undefined;
  if (redirect) {
    return redirectResponse(request, redirect);
  }

  const root = fileURLToPath(directory);
  const path = resolve(root, `.${pathname}`);
  if (outsideRoot(root, path, pathname)) {
    return notFound();
  }

  if (htmlPages && (pathname.endsWith(".html") || (pathname !== "/" && pathname.endsWith("/")))) {
    const canonical = pathname === "/index.html" ? "/" : pathname.replace(/(?:\.html|\/)$/, "");
    return redirectResponse(request, { destination: canonical, status: 308 });
  }

  const filePath =
    htmlPages && !extname(pathname) ? (pathname === "/" ? resolve(root, "index.html") : `${path}.html`) : path;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(request.method === "HEAD" ? null : file, {
      headers: {
        ...(pathname === "/" ? homeHeaders : siteHeaders),
        "Content-Type": contentTypeOf(filePath, file.type),
        ...(filePath.endsWith(".html") ? { "Cache-Control": "no-cache" } : {}),
      },
    });
  }

  if (htmlPages && !extname(pathname)) {
    const errorPage = Bun.file(new URL("404.html", directory));
    return new Response(request.method === "HEAD" ? null : errorPage, {
      status: 404,
      headers: {
        ...siteHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  return notFound();
}
