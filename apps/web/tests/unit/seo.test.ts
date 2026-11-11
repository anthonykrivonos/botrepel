import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MAX_ATTEMPTS } from "../../lib/liveness/flow";
import { RETENTION } from "../../lib/purge";
import { App } from "../../src/App";
import { ARTICLES, articleByPath } from "../../src/site/articles";
import { pages, HOME_HEADING } from "../../src/site/content";
import { FACT_LIMITS } from "../../src/site/facts";
import { installMarkdown } from "../../src/site/install";
import { validateStructuredData } from "../../src/site/jsonld";
import { discoveryFiles, documentTitle, escapeHtml, renderHead, resolveSeoConfig } from "../../src/site/seo";

describe("resolveSeoConfig", () => {
  test("indexes only a production HTTPS origin", () => {
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com" })).toEqual({
      origin: "https://botrepel.com",
      indexable: true,
    });
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com", VERCEL_ENV: "preview" }).indexable).toBe(false);
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com", SEO_NOINDEX: "1" }).indexable).toBe(false);
    expect(resolveSeoConfig({}).indexable).toBe(false);
  });

  test("rejects an origin with a path", () => {
    expect(() => resolveSeoConfig({ SITE_URL: "https://botrepel.com/app" })).toThrow();
  });
});

describe("discovery files", () => {
  test("a local build disallows crawling", () => {
    expect(discoveryFiles({ origin: "", indexable: false })["robots.txt"]).toContain("Disallow: /\n");
  });

  test("an indexable build lists its pages", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["robots.txt"]).toContain("Sitemap: https://botrepel.com/sitemap.xml");
    expect(files["robots.txt"]).toContain("Disallow: /w/");
    expect(files["robots.txt"]).toContain("Disallow: /dashboard");
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/</loc>");
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/about</loc><lastmod>2026-11-10</lastmod>");
    expect(files["sitemap.xml"]).toContain(
      "<loc>https://botrepel.com/articles/botrepel-vs-recaptcha</loc><lastmod>2026-11-10</lastmod>",
    );
    expect(files["sitemap.xml"]).toContain(
      "<loc>https://botrepel.com/articles/block-bots-from-scraping</loc><lastmod>2026-11-11</lastmod>",
    );
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/guides</loc><lastmod>2026-11-11</lastmod>");
    expect(files["sitemap.xml"]).toContain(
      "<loc>https://botrepel.com/guides/block-bots</loc><lastmod>2026-11-11</lastmod>",
    );
    expect(files["robots.txt"]).not.toContain("Disallow: /articles");
    expect(files["robots.txt"]).not.toContain("Disallow: /about");
  });

  test("the head escapes and canonicalizes", () => {
    const head = renderHead(pages[0]!, { origin: "https://botrepel.com", indexable: true });
    expect(head).toContain('<link rel="canonical" href="https://botrepel.com/">');
    expect(head).toContain('content="index, follow"');
    expect(head).toContain('<meta property="og:image" content="https://botrepel.com/og.png">');
    expect(head).toContain('<meta property="og:image:alt" content="BotRepel, human verification for websites.">');
    expect(head).toContain(`<meta name="twitter:title" content="${documentTitle(pages[0]!)}">`);
    expect(head).toContain('<script type="application/ld+json">');
    expect(head).toContain('<meta name="twitter:image" content="https://botrepel.com/og.png">');
    expect(head).toContain('content="summary_large_image"');
  });

  test("the legal pages are indexed", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/privacy</loc>");
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/terms</loc>");
  });
});

const DAY_MS = 24 * 60 * 60_000;

describe("indexable pages", () => {
  const indexed = pages.filter((page) => page.index);
  const config = { origin: "https://botrepel.com", indexable: true } as const;

  test("titles, descriptions, and a single H1 are present in prerendered HTML", () => {
    for (const page of indexed) {
      const title = documentTitle(page);
      expect(title.length, title).toBeGreaterThanOrEqual(50);
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(title.endsWith(" | BotRepel"), title).toBe(true);
      expect(title, page.path).not.toBe(page.heading);
      expect(title.includes("—") || page.description.includes("—") || page.heading.includes("—")).toBe(false);
      expect(page.description.length, page.path).toBeLessThanOrEqual(155);
      expect(page.description.toLowerCase(), page.path).toContain("human verification");
      const head = renderHead(page, config);
      expect(head).toContain(`<title>${title}</title>`);
      expect(head).toContain(`<meta name="description" content="${escapeHtml(page.description)}">`);
      const html = renderToString(createElement(App, { path: page.path }));
      expect(html.match(/<h1\b/g)?.length ?? 0, page.path).toBe(1);
      expect(html, page.path).toContain(`>${page.heading}<`);
    }
  });

  test("JSON-LD matches the schema.org types this site emits", () => {
    for (const page of indexed) {
      const head = renderHead(page, config);
      const json = head.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
      expect(json, page.path).toBeTruthy();
      const article = page.kind === "article" ? articleByPath(page.path) : undefined;
      const errors = validateStructuredData(JSON.parse(json ?? ""), {
        faq: page.kind === "home" || Boolean(article?.faqs?.length),
        article: page.kind === "article",
        howTo: Boolean(article?.howTo),
      });
      expect(errors, page.path).toEqual([]);
    }
  });

  test("article URLs are semantic slugs and comparisons cite a public source", () => {
    expect(indexed.some((page) => page.path === "/articles")).toBe(true);
    for (const article of ARTICLES) {
      expect(article.path).toBe(`/articles/${article.slug}`);
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(article.sources.length).toBeGreaterThan(0);
      if (article.slug.startsWith("botrepel-vs-")) {
        expect(article.sources.some((source) => source.href.startsWith("https://"))).toBe(true);
      }
    }
    expect(HOME_HEADING.startsWith("BotRepel is a ")).toBe(true);
    expect(HOME_HEADING).toContain(" that ");
    expect(HOME_HEADING).toContain(", so ");
  });
});

describe("published figures", () => {
  test("match the server constants", () => {
    expect(FACT_LIMITS.lightCheckAttempts).toBe(MAX_ATTEMPTS);
    expect(FACT_LIMITS.scoreRetentionDays * DAY_MS).toBe(RETENTION.livenessStats);
    expect(FACT_LIMITS.reportRetentionDays * DAY_MS).toBe(RETENTION.reports);
    expect(FACT_LIMITS.expiredRetentionDays * DAY_MS).toBe(RETENTION.expired);
    expect(FACT_LIMITS.rateLimitRetentionHours * 60 * 60_000).toBe(RETENTION.rateLimit);
  });
});

describe("agent docs", () => {
  test("install.md pins the CLI version and points at this origin", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["install.md"]).toMatch(/npx --yes botrepel@\d+\.\d+\.\d+ init/);
    expect(files["install.md"]).toContain("https://botrepel.com/dashboard");
    for (const section of [
      "### Better Auth",
      "### Auth.js (NextAuth)",
      "### Auth0",
      "### Clerk",
      "### Supabase Auth",
    ]) {
      expect(files["install.md"]).toContain(section);
    }
    expect(files["llms.txt"]).toContain("https://botrepel.com/install.md");
  });

  test("a local install.md uses the local CLI, tarball, and API origin", () => {
    const markdown = installMarkdown("http://localhost:3000", {
      pack: "bun run --cwd /repo pack:local",
      cli: "/repo/packages/botrepel/src/cli/bin.ts",
      tarball: "/repo/botrepel.tgz",
    });
    expect(markdown).toContain(
      "bun /repo/packages/botrepel/src/cli/bin.ts init --api http://localhost:3000 --no-install",
    );
    expect(markdown).toContain("npm install /repo/botrepel.tgz");
    expect(markdown).toContain('apiOrigin="http://localhost:3000"');
    expect(markdown).not.toContain("npx");
  });
});
