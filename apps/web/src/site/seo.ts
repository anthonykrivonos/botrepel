import type { SitePage } from "./content";
import { pages } from "./content";
import { installMarkdown, llmsText } from "./install";
import { renderJsonLd } from "./jsonld";
import { canonicalOrigin, type EnvSource, isLoopbackHost, isPreviewDeployment, readEnv } from "../../lib/env";
import { SITE_NAME } from "../shared/constants";
import { absolute, escapeHtml } from "../shared/utils";

export { escapeHtml };

export interface SeoConfig {
  /** The public origin, or "" for a local build. */
  readonly origin: string;
  /** Only production on a real HTTPS origin is indexable. */
  readonly indexable: boolean;
}

export function resolveSeoConfig(source?: EnvSource): SeoConfig {
  const env = readEnv(source);
  const value = canonicalOrigin(env);
  if (!value) {
    return { origin: "", indexable: false };
  }
  const url = new URL(value);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("SITE_URL must be an HTTP(S) origin without a path, query, or credentials.");
  }
  return {
    origin: url.origin,
    indexable:
      url.protocol === "https:" &&
      !isLoopbackHost(url.hostname) &&
      !isPreviewDeployment(env) &&
      env.SEO_NOINDEX !== "1",
  };
}

/** Home leads with the brand. Every other page ends with " | BotRepel". */
export function documentTitle(page: SitePage): string {
  if (page.path === "/") {
    return page.title;
  }
  return `${page.title} | ${SITE_NAME}`;
}

/** Replaces the shell's <title>: title, description, robots, canonical, and social cards. */
export function renderHead(page: SitePage, config: SeoConfig): string {
  const title = escapeHtml(documentTitle(page));
  const description = escapeHtml(page.description);
  const url = config.origin ? escapeHtml(absolute(config.origin, page.path)) : "";
  const image = escapeHtml(absolute(config.origin, page.image ?? "/og.png"));
  const imageAlt = escapeHtml(page.imageAlt ?? "BotRepel, human verification for websites.");
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<meta name="application-name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta name="robots" content="${config.indexable && page.index ? "index, follow" : "noindex, follow"}">`,
    url ? `<link rel="canonical" href="${url}">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    url ? `<meta property="og:url" content="${url}">` : "",
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${imageAlt}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${imageAlt}">`,
    renderJsonLd(page, config.origin),
  ].join("");
}

/** robots.txt and sitemap.xml (a non-indexable build disallows everything), plus the agent docs. */
export function discoveryFiles(config: SeoConfig): Record<string, string> {
  const indexed = pages.filter((page) => page.index);
  const sitemap = config.origin
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed
        .map((page) => {
          const loc = escapeHtml(absolute(config.origin, page.path));
          const lastmod = page.updated ? `<lastmod>${page.updated}</lastmod>` : "";
          return `  <url><loc>${loc}</loc>${lastmod}</url>`;
        })
        .join("\n")}\n</urlset>\n`
    : undefined;
  const robots = config.indexable
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /v1/",
        "Disallow: /w/",
        "Disallow: /admin/",
        "Disallow: /dashboard",
        "Disallow: /device",
        "Disallow: /login",
        "Disallow: /pass/",
        "Disallow: /settings",
        "",
        `Sitemap: ${absolute(config.origin, "/sitemap.xml")}`,
        "",
      ].join("\n")
    : "User-agent: *\nDisallow: /\n";
  return {
    "robots.txt": robots,
    ...(sitemap ? { "sitemap.xml": sitemap } : {}),
    "install.md": installMarkdown(config.origin),
    "llms.txt": llmsText(config.origin),
  };
}
